import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { createLogger } from '@packages/simple-logger';

const logger = createLogger('axios-token-renewal');

type AxiosTokenRenewalHandlers = {
  /** Callback при начале token refresh */
  start?: () => void;
  /** Callback при успешном token refresh */
  success?: () => void;
  /** Callback при ошибке обновления токена */
  failure?: (error: unknown) => void;
}

type AxiosTokenRenewalFlagKeys = {
  /** Ключ для пометки повторных запросов */
  retry?: string;
  /** Ключ для флага пропуска авторизации */
  skipAuth?: string;
}

export interface TokenRenewalConfig {
  /** Функция для обновления токена */
  refresh: () => Promise<boolean>;
  /** Обработчики событий */
  handlers: AxiosTokenRenewalHandlers;
  /** Ключи для флагов */
  flagKeys: AxiosTokenRenewalFlagKeys;
  /** Функция для определения является ли ошибка авторизационной */
  isAuthError?: (error: AxiosError) => boolean;
  /** Флаг, который позволяет отключить логирование в консоль */
  silent?: boolean;
}

// Расширенный тип для конфигурации запроса с нашими флагами
interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  [key: string]: unknown; // Позволяет добавлять кастомные поля
}

interface PendingRequest {
  resolve: (value: AxiosResponse | PromiseLike<AxiosResponse>) => void;
  reject: (reason: unknown) => void;
  config: AxiosRequestConfig;
}

const DEFAULT_CONFIG = {
  flagKeys: {
    retry: '_retry',
    skipAuth: '_skipAuth'
  },
  handlers: {
    start: () => {},
    success: () => {},
    failure: () => {}
  },
  isAuthError: (error) => Boolean(error.response?.status === 401),
  silent: false
} as const satisfies Omit<TokenRenewalConfig, 'refresh'>;

export class TokenRenewalInterceptor {
  private isRefreshing = false;
  private pendingRequests: PendingRequest[] = [];
  private config: DeepRequired<TokenRenewalConfig>;

  constructor(config: TokenRenewalConfig) {
    this.config = {
      ...DEFAULT_CONFIG, ...config,
      flagKeys: { ...DEFAULT_CONFIG.flagKeys, ...config.flagKeys },
      handlers: { ...DEFAULT_CONFIG.handlers, ...config.handlers }
    };
  }

  /**
   * @see https://axios-http.com/docs/interceptors
   * @description
   * 1. axios.interceptors.request.use(onFulfilled, onRejected) — срабатывает *перед* fetch/XHR.
   *    Возвращаете config(или Promise<config>).Если кинете ошибку / Promise.reject, запрос не уйдёт.
   * 2. axios.interceptors.response.use(onFulfilled, onRejected) — срабатывает *после* ответа сервера.
   *    Возвращаете response(или что - то иное — тогда вызывающий код это и получит).Бросите ошибку — полетит в catch.
   *
   * В данном классе используется response interceptor для обработки ошибок авторизации.
   */
  public setupInterceptors(axiosInstance: AxiosInstance = axios): void {
    // Response interceptor
    axiosInstance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as ExtendedAxiosRequestConfig;

        if (!originalRequest) {
          return Promise.reject(error);
        }

        // Проверяем, является ли это ошибкой авторизации
        const isAuthError = this.config.isAuthError(error);
        const isRetry = originalRequest[this.config.flagKeys.retry];
        const skipAuth = originalRequest[this.config.flagKeys.skipAuth];

        if (isAuthError && !isRetry && !skipAuth) {
          logger.info('🔄 Обрабатываем 401 ошибку и запускаем token renewal');
          return this.handleAuthError(originalRequest, axiosInstance);
        }

        logger.error(`Передаем ошибку дальше: ${error.response?.status}`);
        return Promise.reject(error);
      }
    );
  }

  /**
   * @description
   * 1. Если запрос был отменён, то кидаем ошибку.
   * 2. Если уже идёт обновление токена, то добавляем запрос в очередь.
   * 3. Начинаем обновление токена.
   */
  private async handleAuthError(
    originalRequest: ExtendedAxiosRequestConfig,
    axiosInstance: AxiosInstance
  ): Promise<AxiosResponse> {
    // Если запрос был отменён
    if (originalRequest.signal?.aborted) {
      throw new Error('Request aborted');
    }

    // Если уже идёт обновление токена
    if (this.isRefreshing) {
      logger.info('⏳ Refresh уже в процессе, добавляем в очередь');
      return this.queueRequest(originalRequest);
    }

    // Начинаем обновление токена
    this.isRefreshing = true;
    originalRequest[this.config.flagKeys.retry] = true;

    try {
      logger.info('🔑 Начинаем refresh токена');
      this.config.handlers.start?.();

      const success = await this.config.refresh();

      if (success) {
        originalRequest[this.config.flagKeys.retry] = true;
      }

      if (!success) {
        logger.error('Token refresh failed');
        const error = new Error('Token refresh failed');
        this.config.handlers.failure?.(error);
        throw error;
      }

      logger.info('✅ Token refresh успешен, обрабатываем очередь');
      this.config.handlers.success?.();

      // Выполняем все отложенные запросы
      this.processPendingRequests(null, axiosInstance);
    } catch (error) {
      // Обработка ошибки обновления токена
      logger.error(`❌ Ошибка во время refresh или повтора: ${error}`);
      this.config.handlers.failure?.(error);
      this.processPendingRequests(error, axiosInstance);
      return Promise.reject(error);
    } finally {
      this.isRefreshing = false;
    }

    try {
      // Повторяем исходный запрос
      logger.info('🔄 Повторяем исходный запрос');
      const result = await axiosInstance(originalRequest);
      logger.info(`✅ Исходный запрос успешен: ${result.status}`);
      return result;
    } catch (error) {
      logger.error(`❌ Ошибка во время повтора: ${error}`);
      return Promise.reject(error);
    }
  }

  private queueRequest(config: ExtendedAxiosRequestConfig): Promise<AxiosResponse> {
    return new Promise((resolve, reject) => {
      const request: PendingRequest = {
        resolve,
        reject,
        config
      };

      // Обработчик отмены запроса
      if (config.signal instanceof AbortSignal) {
        const abortHandler = () => {
          const index = this.pendingRequests.indexOf(request);
          if (index !== -1) {
            this.pendingRequests.splice(index, 1);
          }
          reject(new Error('Request aborted'));
        };
        config.signal.addEventListener('abort', abortHandler);
      }

      this.pendingRequests.push(request);
    });
  }

  private processPendingRequests(error: unknown, axiosInstance: AxiosInstance): void {
    const requests = [...this.pendingRequests];
    this.pendingRequests = [];

    logger.info(`📋 Обрабатываем ${requests.length} запросов из очереди`);

    requests.forEach(({ resolve, reject, config }) => {
      if (error) {
        logger.error('❌ Отклоняем запрос из очереди из-за ошибки');
        reject(error);
      } else {
        // Помечаем как повторный запрос
        const extendedConfig = config as ExtendedAxiosRequestConfig;
        extendedConfig[this.config.flagKeys.retry] = true;
        logger.info('🔄 Повторяем запрос из очереди');
        axiosInstance(extendedConfig)
          .then((response) => {
            logger.info(`✅ Запрос из очереди успешен: ${response.status}`);
            resolve(response);
          })
          .catch((err) => {
            logger.error(`❌ Ошибка в запросе из очереди: ${err}`);
            reject(err);
          });
      }
    });
  }
}

// Экспортируем удобную функцию для быстрой настройки
export function setupAxiosTokenRenewal(
  config: TokenRenewalConfig,
  axiosInstance: AxiosInstance = axios
): TokenRenewalInterceptor {
  const interceptor = new TokenRenewalInterceptor(config);
  interceptor.setupInterceptors(axiosInstance);
  return interceptor;
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
