import {
  ApolloLink,
  FetchResult,
  Observable,
  Operation,
  NextLink,
} from '@apollo/client/core';
import { ErrorResponse } from '@apollo/client/link/error';
import { Subscription } from 'zen-observable-ts';
import { createLogger } from '@packages/simple-logger';

const logger = createLogger('apollo-token-renewal');

type ApolloTokenRenewalHandlers = {
  /** Callback при начале token refresh */
  start?: () => void;
  /** Callback при успешном token refresh */
  success?: () => void;
  /** Callback при ошибке token refresh */
  failure?: (error: unknown) => void;
}

type ApolloTokenRenewalFlagKeys = {
  /** Ключ для пометки повторных запросов */
  retry?: string;
  /** Ключ для флага пропуска авторизации */
  skipAuth?: string;
}

export interface TokenRenewalConfig {
  /** Функция для обновления токена */
  refresh: () => Promise<boolean>;
  /** Обработчики событий */
  handlers: ApolloTokenRenewalHandlers;
  /** Ключи для флагов */
  flagKeys: ApolloTokenRenewalFlagKeys;
  /** Функция для определения является ли ошибка авторизационной */
  isAuthError?: (error: ErrorResponse) => boolean;
  /** Флаг, который позволяет отключить логирование в консоль */
  silent?: boolean;
}

type PendingRequestCallback = (error?: unknown) => void;

// Расширенный контекст операции с нашими флагами
interface ExtendedOperationContext extends Record<string, unknown> {
  fetchOptions?: {
    signal?: AbortSignal;
  };
}

const DEFAULT_CONFIG = {
  flagKeys: {
    retry: '_retry',
    skipAuth: '_skipAuth'
  },
  handlers: {
    start: () => { },
    success: () => { },
    failure: () => { },
  },
  isAuthError: (error) => {
    // Проверяем network error на статус 401
    const hasNetworkAuth = Boolean(error.networkError &&
      'statusCode' in error.networkError &&
      error.networkError.statusCode === 401);

    // Проверяем graphQLErrors на UNAUTHENTICATED ошибку
    const hasGraphQLAuth = error.graphQLErrors?.some(gqlError =>
      gqlError.extensions?.code === 'UNAUTHENTICATED' ||
      gqlError.message?.includes('Unauthorized') ||
      gqlError.message?.includes('UNAUTHENTICATED')
    ) || false;

    return hasNetworkAuth || hasGraphQLAuth;
  },
  silent: false
} as const satisfies Omit<TokenRenewalConfig, 'refresh'>;

export class TokenRenewalLink extends ApolloLink {
  private pendingRequests: PendingRequestCallback[] = [];
  private refreshPromise: Promise<void> | null = null;
  private config: DeepRequired<TokenRenewalConfig>;

  constructor(config: TokenRenewalConfig) {
    super();

    this.config = {
      ...DEFAULT_CONFIG, ...config,
      flagKeys: { ...DEFAULT_CONFIG.flagKeys, ...config.flagKeys },
      handlers: { ...DEFAULT_CONFIG.handlers, ...config.handlers }
    };
  }

  public request(operation: Operation, forward: NextLink): Observable<FetchResult> {
    // Если запрос помечен для пропуска авторизации, пропускаем его
    if (operation.getContext()[this.config.flagKeys.skipAuth]) {
      return forward(operation);
    }

    // Проверяем не отменен ли запрос до начала выполнения
    const context = operation.getContext() as ExtendedOperationContext;
    const signal = context.fetchOptions?.signal;

    if (signal?.aborted) {
      return new Observable<FetchResult>((observer) => {
        observer.error(new Error('Request aborted'));
      });
    }

    return new Observable<FetchResult>((observer) => {
      let subscription: Subscription | null = null;

      // Создаем обработчик отмены
      const abortHandler = () => {
        if (subscription) {
          subscription.unsubscribe();
        }
        observer.error(new Error('Request aborted'));
      };

      // Подписываемся на событие отмены
      if (signal) {
        signal.addEventListener('abort', abortHandler);
      }

      // Выполняем запрос
      const sub = forward(operation).subscribe({
        next: (value) => observer.next?.(value),
        error: (error) => {
          // Извлекаем graphQLErrors из ошибки
          const graphQLErrors = error?.graphQLErrors || [];
          const networkError = error?.networkError || error;

          // Проверяем, является ли это ошибкой авторизации
          if (this.config.isAuthError({
            networkError,
            graphQLErrors,
            operation,
            forward
          })) {
            logger.info('🔄 Обрабатываем auth ошибку и запускаем token renewal');
            if (graphQLErrors.length > 0) {
              logger.info(`📋 GraphQL ошибки: ${graphQLErrors.map((err: any) => err.message).join(', ')}`);
            }
            if (networkError) {
              logger.info(`🌐 Network ошибка: ${networkError.message || networkError}`);
            }
            // Заменяем оригинальный запрос на Observable который ждет refresh
            const authErrorObservable = this.handleAuthError({
              networkError,
              graphQLErrors,
              operation,
              forward
            });

            // Подписываемся на новый Observable
            authErrorObservable.subscribe({
              next: (value) => observer.next?.(value),
              error: (err) => observer.error?.(err),
              complete: () => observer.complete?.()
            });
          } else {
            logger.error(`❌ Передаем не-auth ошибку дальше: ${error}`);
            // Передаем только не-auth ошибки
            observer.error?.(error);
          }
        },
        complete: () => observer.complete?.()
      });

      subscription = sub;

      return () => {
        if (signal) {
          signal.removeEventListener('abort', abortHandler);
        }
        if (subscription) {
          subscription.unsubscribe();
        }
      };
    });
  }

  private handleAuthError(
    errorResponse: ErrorResponse
  ): Observable<FetchResult> {
    const { operation, forward } = errorResponse;

    // Если уже был произведён повторный запрос, не обрабатываем
    if (operation.getContext()[this.config.flagKeys.retry]) {
      // Возвращаем Observable который сразу завершается с ошибкой
      return new Observable<FetchResult>((observer) => {
        observer.error(new Error('Authorization failed after retry'));
      });
    }

    // Создаем Observable который заменит оригинальный запрос
    return new Observable<FetchResult>((observer) => {
      const context = operation.getContext() as ExtendedOperationContext;
      const signal = context.fetchOptions?.signal;

      // Если запрос уже отменён
      if (signal?.aborted) {
        logger.info('⏹️ Запрос уже был отменен');
        observer.complete();
        return;
      }

      // Если refresh ещё не запущен, запускаем его
      if (!this.refreshPromise) {
        logger.info('🚀 Запускаем новый refresh');
        this.refreshPromise = this.performTokenRefresh();
      } else {
        logger.info('⏳ Refresh уже в процессе, добавляем в очередь');
      }

      // Добавляем callback в очередь
      const callback: PendingRequestCallback = (error?: unknown) => {
        if (signal?.aborted) {
          logger.info('⏹️ Запрос был отменен в очереди');
          observer.complete();
          return;
        }

        if (error) {
          logger.error(`❌ Ошибка refresh, передаем ошибку: ${error}`);
          observer.error(error);
          return;
        }

        logger.info('🔄 Token refresh успешен, повторяем запрос');
        // Помечаем операцию как повторную
        operation.setContext({
          ...operation.getContext(),
          [this.config.flagKeys.retry]: true
        });

        // Повторяем запрос
        const subscription = forward(operation).subscribe({
          next: (value) => {
            logger.info('✅ Повторный запрос успешен');
            observer.next(value);
          },
          error: (err) => {
            logger.error(`❌ Ошибка в повторном запросе: ${err}`);
            observer.error(err);
          },
          complete: () => {
            logger.info('🏁 Повторный запрос завершен');
            observer.complete();
          }
        });

        // Очистка при отмене
        if (signal) {
          signal.addEventListener('abort', () => {
            subscription.unsubscribe();
            observer.complete();
          });
        }
      };

      this.pendingRequests.push(callback);

      // Функция очистки при отмене Observable
      return () => {
        if (signal) {
          signal.removeEventListener('abort', () => { });
        }

        // Удаляем callback из очереди
        const index = this.pendingRequests.indexOf(callback);
        if (index !== -1) {
          this.pendingRequests.splice(index, 1);
        }
      };
    });
  }

  private async performTokenRefresh(): Promise<void> {
    try {
      logger.info('🔑 Начинаем refresh токена');
      this.config.handlers.start?.();

      const success = await this.config.refresh();

      if (!success) {
        logger.error('Token refresh failed');
        const error = new Error('Token refresh failed');
        this.config.handlers.failure?.(error);
        throw error;
      }

      logger.info('✅ Token refresh успешен, обрабатываем очередь');
      this.config.handlers.success?.();

      // Выполняем все отложенные запросы
      this.processPendingRequests();
    } catch (error) {
      // Обработка ошибки обновления токена
      logger.error(`❌ Ошибка во время refresh: ${error}`);
      this.config.handlers.failure?.(error);
      this.processPendingRequests(error);
      throw error;
    } finally {
      this.refreshPromise = null;
    }
  }

  private processPendingRequests(error?: unknown): void {
    const requests = [...this.pendingRequests];
    this.pendingRequests = [];

    logger.info(`📋 Обрабатываем ${requests.length} запросов из очереди`);
    requests.forEach(callback => callback(error));
  }
}

// Экспортируем удобную функцию для создания link
export function createTokenRenewalLink(config: TokenRenewalConfig): TokenRenewalLink {
  return new TokenRenewalLink(config);
}

type DeepRequired<T> =
  // Не трогаем функции
  T extends (...args: any[]) => any ? T
  // Обрабатываем массивы и кортежи
  : T extends readonly [any, ...any[]] | readonly any[]
  ? { [K in keyof T]: DeepRequired<T[K]> }
  // Обрабатываем объекты
  : T extends object
  ? { [K in keyof T]-?: DeepRequired<T[K]> }
  // Примитивы и прочее оставляем как есть
  : T;
