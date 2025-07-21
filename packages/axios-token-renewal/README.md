# Axios Token Renewal

Пакет для автоматического обновления токенов при 401 ошибках в Axios.

## Установка

```bash
npm install @packages/axios-token-renewal
```

## Использование

```typescript
import axios from 'axios';
import { setupAxiosTokenRenewal } from '@packages/axios-token-renewal';

// Создайте инстанс axios (опционально)
const axiosInstance = axios.create({
  baseURL: 'https://api.example.com'
});

// Настройте token renewal
setupAxiosTokenRenewal({
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

  // Опционально: ключи для флагов (для избежания конфликтов)
  flagKeys: {
    retry: '_retry',
    skipAuth: '_skipAuth'
  },

  // Опционально: функция определения ошибки авторизации
  isAuthError: (error) => error.response?.status === 401,

  // Опционально: отключить логирование
  silent: false
}, axiosInstance);
```

## Особенности

- Автоматически перехватывает 401 ошибки
- Выполняет только один refresh запрос при множественных ошибках
- Ставит остальные запросы в очередь
- Повторяет все запросы после успешного обновления токена
- Поддерживает отмену запросов через AbortController
- Полная типизация TypeScript

## API

### setupAxiosTokenRenewal(config, axiosInstance?)

Настраивает interceptor для обработки ошибок авторизации.

#### Параметры

- `config: TokenRenewalConfig` - конфигурация
  - `refresh: () => Promise<boolean>` - функция обновления токена (обязательно)
  - `handlers?: object` - обработчики событий
    - `start?: () => void` - callback при начале refresh
    - `success?: () => void` - callback при успешном refresh
    - `failure?: (error: unknown) => void` - callback при ошибке refresh
  - `flagKeys?: object` - ключи для флагов
    - `retry?: string` - ключ для флага повтора (по умолчанию '_retry')
    - `skipAuth?: string` - ключ для пропуска авторизации (по умолчанию '_skipAuth')
  - `isAuthError?: (error: AxiosError) => boolean` - функция определения ошибки авторизации (по умолчанию проверяет статус 401)
  - `silent?: boolean` - отключить логирование (по умолчанию false)
- `axiosInstance?: AxiosInstance` - инстанс axios (по умолчанию глобальный)

#### Возвращает

- `TokenRenewalInterceptor` - экземпляр interceptor для дополнительного управления

### Пропуск авторизации для конкретных запросов

```typescript
// Этот запрос не будет перехватываться при 401
axios.get('/public-endpoint', {
  _skipAuth: true
});
```

### Использование с AbortController

```typescript
const controller = new AbortController();

axios.get('/api/data', {
  signal: controller.signal
});

// Отмена запроса
controller.abort();
```

## Примеры

### Базовая настройка

```typescript
import { setupAxiosTokenRenewal } from '@packages/axios-token-renewal';

setupAxiosTokenRenewal({
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
import { setupAxiosTokenRenewal } from '@packages/axios-token-renewal';

setupAxiosTokenRenewal({
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
    // Кастомная логика определения ошибки авторизации
    return error.response?.status === 401 ||
           error.response?.status === 403;
  },
  silent: process.env.NODE_ENV === 'production'
});
```
