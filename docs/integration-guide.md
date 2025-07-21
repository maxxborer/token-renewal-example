# Руководство по интеграции Token Renewal

## Быстрый старт

### Для Axios

```typescript
import { setupAxiosTokenRenewal } from '@packages/axios-token-renewal';
import axios from 'axios';
import router from './router';

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true
});

setupAxiosTokenRenewal({
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
  handlers: {
    failure: () => {
      // Очистить локальное состояние
      localStorage.clear();
      // Перенаправить на логин
      router.push('/login');
    }
  }
}, axiosInstance);

export default axiosInstance;
```

### Для Apollo Client

```typescript
import { createTokenRenewalLink } from '@packages/apollo-token-renewal';
import { ApolloClient, InMemoryCache, createHttpLink, ApolloLink } from '@apollo/client';

const httpLink = createHttpLink({
  uri: import.meta.env.VITE_GRAPHQL_URL,
  credentials: 'include'
});

const tokenRenewalLink = createTokenRenewalLink({
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
  handlers: {
    failure: () => {
      window.location.href = '/login';
    }
  }
});

export const apolloClient = new ApolloClient({
  link: ApolloLink.from([tokenRenewalLink, httpLink]),
  cache: new InMemoryCache()
});
```

## Best Practices

### 1. Обработка токенов

#### ✅ Рекомендуется

```typescript
// Использовать httpOnly cookies
res.cookie('authToken', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 дней
});

// Separate refresh token
res.cookie('refresh', refresh, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/auth/refresh', // Ограничить путь
  maxAge: 30 * 24 * 60 * 60 * 1000 // 30 дней
});
```

#### ❌ Не рекомендуется

```typescript
// НЕ хранить токены в localStorage
localStorage.setItem('token', token);

// НЕ передавать в URL
axios.get(`/api/data?token=${token}`);

// НЕ использовать короткие токены
const token = Math.random().toString(36); // Слабая энтропия
```

### 2. Конфигурация refresh

#### ✅ Рекомендуется

```typescript
const refresh = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      // Обновить локальную информацию о пользователе
      userStore.updateUserInfo(data.user);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return false;
  }
};
```

#### ❌ Не рекомендуется

```typescript
// НЕ игнорировать ошибки
const refresh = async () => {
  const response = await fetch('/auth/refresh');
  return true; // Всегда возвращать true
};

// НЕ делать бесконечные попытки
const refresh = async () => {
  while (true) {
    try {
      const response = await fetch('/auth/refresh');
      if (response.ok) return true;
    } catch {}
  }
};
```

### 3. Обработка ошибок

#### ✅ Рекомендуется

```typescript
// Для Axios
setupAxiosTokenRenewal({
  refresh,
  handlers: {
    failure: () => {
      // Логирование для мониторинга
      analytics.track('auth_failure', {
        timestamp: new Date().toISOString(),
        url: window.location.pathname
      });

      // Показать уведомление пользователю
      toast.error('Сессия истекла. Пожалуйста, войдите снова.');

      // Очистить чувствительные данные
      store.dispatch('auth/logout');

      // Сохранить путь для возврата после логина
      const returnUrl = window.location.pathname;
      router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
    }
  }
});

// Для Apollo
const tokenRenewalLink = createTokenRenewalLink({
  refresh,
  handlers: {
    failure: () => {
      // Аналогичная обработка ошибок
      apolloClient.clearStore();
      store.dispatch('auth/logout');
      router.push('/login');
    }
  }
});
```

### 4. Оптимизация производительности

#### Кеширование результатов refresh

```typescript
let refreshPromise: Promise<boolean> | null = null;

const refresh = async (): Promise<boolean> => {
  // Если уже идёт refresh, вернуть существующий промис
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = performRefresh();

  try {
    const result = await refreshPromise;
    return result;
  } finally {
    // Очистить кеш через небольшую задержку
    setTimeout(() => {
      refreshPromise = null;
    }, 100);
  }
};
```

#### Дебаунс множественных 401

```typescript
import { debounce } from 'lodash';

const debouncedRefresh = debounce(
  () => refresh(),
  100,
  { leading: true, trailing: false }
);
```

### 5. Мониторинг и аналитика

#### Метрики для отслеживания

```typescript
interface TokenRenewalMetrics {
  refreshAttempts: number;
  refreshSuccesses: number;
  refreshFailures: number;
  averageRefreshTime: number;
  queueSizes: number[];
}

const metrics: TokenRenewalMetrics = {
  refreshAttempts: 0,
  refreshSuccesses: 0,
  refreshFailures: 0,
  averageRefreshTime: 0,
  queueSizes: []
};

// Обновлять метрики
setupAxiosTokenRenewal({
  refresh: async () => {
    const startTime = Date.now();
    metrics.refreshAttempts++;

    try {
      const success = await performRefresh();

      if (success) {
        metrics.refreshSuccesses++;
      } else {
        metrics.refreshFailures++;
      }

      // Обновить среднее время
      const duration = Date.now() - startTime;
      metrics.averageRefreshTime =
        (metrics.averageRefreshTime * (metrics.refreshAttempts - 1) + duration) /
        metrics.refreshAttempts;

      return success;
    } catch (error) {
      metrics.refreshFailures++;
      throw error;
    }
  }
});

// Отправлять метрики
setInterval(() => {
  if (metrics.refreshAttempts > 0) {
    analytics.track('token_renewal_metrics', metrics);
  }
}, 60000); // Каждую минуту
```

### 6. Тестирование

#### Unit тесты

```typescript
import { setupAxiosTokenRenewal } from '@packages/axios-token-renewal';
import MockAdapter from 'axios-mock-adapter';

describe('Token Renewal', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  it('should refresh token on 401', async () => {
    const refresh = jest.fn().mockResolvedValue(true);

    setupAxiosTokenRenewal({ refresh }, axios);

    // Первый запрос возвращает 401
    mock.onGet('/api/data').replyOnce(401);
    // Повторный запрос успешен
    mock.onGet('/api/data').replyOnce(200, { data: 'test' });

    const response = await axios.get('/api/data');

    expect(refresh).toHaveBeenCalledOnce();
    expect(response.data).toEqual({ data: 'test' });
  });

  it('should queue multiple 401 requests', async () => {
    const refresh = jest.fn().mockResolvedValue(true);

    setupAxiosTokenRenewal({ refresh }, axios);

    // Все запросы получают 401
    mock.onAny().replyOnce(401).onAny().reply(200, { success: true });

    // Запускаем параллельно
    const promises = [
      axios.get('/api/1'),
      axios.get('/api/2'),
      axios.get('/api/3')
    ];

    const results = await Promise.all(promises);

    // Только один refresh
    expect(refresh).toHaveBeenCalledOnce();
    // Все запросы успешны
    expect(results).toHaveLength(3);
    expect(results.every(r => r.data.success)).toBe(true);
  });
});
```

#### E2E тесты

```typescript
describe('Token Renewal E2E', () => {
  it('should handle token expiration gracefully', () => {
    cy.login('demo', 'demo');
    cy.visit('/dashboard');

    // Эмулировать истечение токена
    cy.intercept('GET', '/api/**', { statusCode: 401 }).as('unauthorizedRequest');
    cy.intercept('POST', '/auth/refresh', { statusCode: 200 }).as('tokenRefresh');

    // Выполнить действие
    cy.get('[data-cy=load-users]').click();

    // Проверить, что refresh выполнен
    cy.wait('@tokenRefresh');

    // Проверить, что данные загружены
    cy.get('[data-cy=users-list]').should('be.visible');
  });
});
```

### 7. Обработка специальных случаев

#### SSR (Server-Side Rendering)

```typescript
// Для Nuxt.js (Vue SSR)
export default function ({ $axios, redirect, store }) {
  setupAxiosTokenRenewal({
    refresh: async () => {
      // На сервере использовать серверный метод
      if (process.server) {
        return await store.dispatch('auth/serverRefresh');
      }
      // На клиенте обычный refresh
      return await store.dispatch('auth/refresh');
    },
    handlers: {
      failure: () => {
        // На сервере вернуть 401
        if (process.server) {
          throw new Error('Unauthorized');
        }
        // На клиенте редирект
        redirect('/login');
      }
    }
  }, $axios);
}
```

#### Мобильные приложения

```typescript
// Для Vue + Capacitor
import { Preferences } from '@capacitor/preferences';

setupAxiosTokenRenewal({
  refresh: async () => {
    try {
      // Использовать сохранённый refresh token
      const { value: refreshToken } = await Preferences.get({ key: 'refreshToken' });
      if (!refreshToken) return false;

      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${refreshToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        await Preferences.set({
          key: 'accessToken',
          value: data.accessToken
        });
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }
});
```

## Чеклист интеграции

- [ ] Настроены httpOnly cookies для токенов
- [ ] Реализован refresh endpoint на сервере
- [ ] Установлены пакеты token renewal
- [ ] Настроена обработка failure в handlers
- [ ] Добавлено логирование для отладки
- [ ] Настроен мониторинг метрик
- [ ] Написаны unit тесты
- [ ] Проведено нагрузочное тестирование
- [ ] Настроены алерты на аномалии
- [ ] Документирована конфигурация

## Частые ошибки

### 1. Циклический refresh

**Проблема**: Refresh endpoint тоже возвращает 401, создавая цикл.

**Решение**:

```typescript
// Пометить refresh запросы через flagKeys
setupAxiosTokenRenewal({
  refresh: async () => {
    const response = await fetch('/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    });
    return response.ok;
  },
  flagKeys: {
    skipAuth: '_skipAuth'
  }
});

// Или использовать отдельный axios instance без interceptor
const refreshAxios = axios.create();
```

### 2. Потеря контекста запроса

**Проблема**: FormData или специальные заголовки теряются при повторе.

**Решение**: Пакеты автоматически сохраняют конфигурацию запроса, включая FormData и заголовки.

### 3. Memory leaks

**Проблема**: Очередь запросов не очищается.

**Решение**: Пакеты автоматически очищают очередь и поддерживают AbortController для отмены запросов.

```typescript
// Правильная отмена запросов
const controller = new AbortController();

axios.get('/api/data', {
  signal: controller.signal
});

// При необходимости отменить
controller.abort();
```
