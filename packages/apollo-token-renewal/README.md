# Apollo Token Renewal

Пакет для автоматического обновления токенов при 401 ошибках в Apollo Client.

## Установка

```bash
npm install @packages/apollo-token-renewal
```

## Использование

```typescript
import { ApolloClient, InMemoryCache, createHttpLink, ApolloLink } from '@apollo/client';
import { createTokenRenewalLink } from '@packages/apollo-token-renewal';

// HTTP Link
const httpLink = createHttpLink({
  uri: 'https://api.example.com/graphql',
  credentials: 'include'
});

// Token Renewal Link
const tokenRenewalLink = createTokenRenewalLink({
  // Функция для обновления токена
  refresh: async () => {
    try {
      const response = await fetch('/auth/refresh', {
        method: 'POST',
        credentials: 'include'
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  // Обработчики событий
  handlers: {
    start: () => console.log('Начинаем refresh токена'),
    success: () => console.log('Токен успешно обновлен'),
    failure: (error) => {
      console.error('Не удалось обновить токен:', error);
      window.location.href = '/login';
    }
  },

  // Опционально: ключи для флагов
  flagKeys: {
    retry: '_retry',
    skipAuth: '_skipAuth'
  },

  // Опционально: функция определения авторизационной ошибки
  isAuthError: (error) => {
    // Проверяем network error на статус 401
    const hasNetworkAuth = Boolean(
      error.networkError &&
      'statusCode' in error.networkError &&
      error.networkError.statusCode === 401
    );

    // Проверяем graphQLErrors на UNAUTHENTICATED ошибку
    const hasGraphQLAuth = error.graphQLErrors?.some(gqlError =>
      gqlError.extensions?.code === 'UNAUTHENTICATED' ||
      gqlError.message?.includes('Unauthorized') ||
      gqlError.message?.includes('UNAUTHENTICATED')
    ) || false;

    return hasNetworkAuth || hasGraphQLAuth;
  },

  // Опционально: отключить логирование
  silent: false
});

// Создание Apollo Client
const apolloClient = new ApolloClient({
  link: ApolloLink.from([tokenRenewalLink, httpLink]),
  cache: new InMemoryCache()
});
```

## Особенности

- Автоматически перехватывает 401 ошибки в GraphQL запросах
- Выполняет только один refresh запрос при множественных ошибках
- Ставит остальные запросы в очередь
- Повторяет все запросы после успешного обновления токена
- Поддерживает отмену запросов через AbortController
- Полная типизация TypeScript

## API

### createTokenRenewalLink(config)

Создаёт Apollo Link для обработки ошибок авторизации.

#### Параметры

- `config: TokenRenewalConfig` - конфигурация
  - `refresh: () => Promise<boolean>` - функция обновления токена (обязательно)
  - `handlers?: object` - обработчики событий
    - `start?: () => void` - callback при начале refresh
    - `success?: () => void` - callback при успешном refresh
    - `failure?: (error: unknown) => void` - callback при ошибке refresh
  - `flagKeys?: object` - ключи для флагов
    - `retry?: string` - ключ для флага повтора в контексте (по умолчанию '_retry')
    - `skipAuth?: string` - ключ для пропуска авторизации (по умолчанию '_skipAuth')
  - `isAuthError?: (error: ErrorResponse) => boolean` - функция определения ошибки авторизации
  - `silent?: boolean` - отключить логирование (по умолчанию false)

#### Возвращает

- `TokenRenewalLink` - экземпляр Apollo Link для использования в цепочке

### Пропуск авторизации для конкретных запросов

```typescript
// Этот запрос не будет перехватываться при 401
apolloClient.query({
  query: PUBLIC_QUERY,
  context: {
    _skipAuth: true
  }
});
```

### Использование с AbortController

```typescript
const controller = new AbortController();

apolloClient.query({
  query: MY_QUERY,
  context: {
    fetchOptions: {
      signal: controller.signal
    }
  }
});

// Отмена запроса
controller.abort();
```

## Примеры

### Базовая настройка

```typescript
import { createTokenRenewalLink } from '@packages/apollo-token-renewal';

const tokenRenewalLink = createTokenRenewalLink({
  refresh: async () => {
    const response = await fetch('/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    });
    return response.ok;
  },
  handlers: {
    failure: () => {
      localStorage.clear();
      window.location.href = '/login';
    }
  }
});
```

### Расширенная настройка

```typescript
import { createTokenRenewalLink } from '@packages/apollo-token-renewal';

const tokenRenewalLink = createTokenRenewalLink({
  refresh: async () => {
    try {
      const response = await fetch('/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Дополнительная обработка данных пользователя
        console.log('Токен обновлен для пользователя:', data.user);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Ошибка при обновлении токена:', error);
      return false;
    }
  },
  handlers: {
    start: () => {
      // Показать индикатор загрузки
      document.body.classList.add('refreshing-token');
    },
    success: () => {
      // Скрыть индикатор загрузки
      document.body.classList.remove('refreshing-token');
      console.log('Токен успешно обновлен');
    },
    failure: (error) => {
      // Скрыть индикатор загрузки
      document.body.classList.remove('refreshing-token');
      // Очистить данные и перенаправить
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login?expired=true';
    }
  },
  flagKeys: {
    retry: 'custom_retry_flag',
    skipAuth: 'custom_skip_auth_flag'
  },
  isAuthError: (error) => {
    // Кастомная логика для определения ошибки авторизации
    const isNetworkAuth = error.networkError &&
      ('statusCode' in error.networkError && error.networkError.statusCode === 401);

    const isGraphQLAuth = error.graphQLErrors?.some(gqlError =>
      gqlError.extensions?.code === 'UNAUTHENTICATED' ||
      gqlError.extensions?.code === 'FORBIDDEN' ||
      gqlError.message?.includes('Unauthorized')
    );

    return Boolean(isNetworkAuth || isGraphQLAuth);
  },
  silent: process.env.NODE_ENV === 'production'
});
```

### Интеграция с существующими Link

```typescript
import { ApolloClient, InMemoryCache, createHttpLink, ApolloLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { createTokenRenewalLink } from '@packages/apollo-token-renewal';

// HTTP Link
const httpLink = createHttpLink({
  uri: '/graphql',
  credentials: 'include'
});

// Auth Link для добавления заголовков
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('accessToken');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    }
  }
});

// Token Renewal Link
const tokenRenewalLink = createTokenRenewalLink({
  refresh: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;

    const response = await fetch('/auth/refresh', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${refreshToken}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('accessToken', data.accessToken);
      return true;
    }

    return false;
  },
  handlers: {
    failure: () => {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
    }
  }
});

// Создание Apollo Client с цепочкой Link
const apolloClient = new ApolloClient({
  link: ApolloLink.from([
    tokenRenewalLink,
    authLink,
    httpLink
  ]),
  cache: new InMemoryCache()
});
```
