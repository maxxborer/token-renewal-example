# Token Renewal Example

Демонстрационный проект для показа работы автоматического обновления токенов при 401 ошибках.

## Возможности

- ✅ Перехват 401 ошибок для REST (Axios) и GraphQL (Apollo) запросов
- ✅ Фоновое обновление токена без прерывания работы пользователя
- ✅ Повтор упавших запросов после успешного обновления токена
- ✅ Обработка параллельных запросов (только один refresh запрос)
- ✅ Поддержка отмены запросов (AbortController)
- ✅ Готовые пакеты для интеграции в проекты

## Структура проекта

```bash
token-renewal-example/
├── apps/
│   ├── client/              # Vue 3 + TypeScript клиент
│   └── server/              # Express + TypeScript сервер
├── packages/
│   ├── axios-token-renewal/   # Пакет для Axios
│   ├── apollo-token-renewal/  # Пакет для Apollo
│   └── simple-logger/         # Пакет для логирования
```

## Быстрый старт

### Требования

- Node.js >= 22.12.0 (используйте `nvm use` в корне проекта)
- Yarn

### 1. Установка зависимостей

```bash
# Переключитесь на правильную версию Node
nvm use

# Установите все зависимости
yarn install
```

### 2. Запуск проекта

```bash
# Соберите пакеты и запустите приложения
yarn start

# Или отдельными командами:
yarn build:packages  # Собрать пакеты
yarn serve          # Запустить сервер и клиент
```

### 3. Использование

1. Откройте <http://localhost:5173>
2. Войдите с логином `demo` и паролем `demo`
3. Тестируйте различные сценарии:
   - Обычные запросы
   - Параллельные запросы
   - Отмена запросов
   - "Протухание" токена (слабое/сильное)

## Команды Nx

```bash
# Посмотреть граф зависимостей
yarn graph

# Собрать все проекты
yarn build

# Запустить все в dev режиме
yarn dev

# Собрать конкретный пакет
yarn nx build @packages/axios-token-renewal

# Запустить конкретное приложение
yarn nx serve client
```

## Как это работает

### 1. Перехват 401 ошибок

Когда сервер возвращает 401, interceptor/link перехватывает ошибку и проверяет, можно ли обновить токен.

### 2. Очередь запросов

Если уже идёт обновление токена, новые запросы добавляются в очередь и ждут результата.

### 3. Обновление токена

Выполняется один запрос на обновление токена. При успехе - все запросы из очереди повторяются.

### 4. Обработка ошибок

Если токен не удалось обновить (например, при "сильном" протухании), пользователь перенаправляется на страницу входа.

## Использование пакетов

### Axios Token Renewal

```typescript
import { setupAxiosTokenRenewal } from '@packages/axios-token-renewal';

setupAxiosTokenRenewal({
  refresh: async () => {
    // Ваша логика обновления токена
    const response = await fetch('/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    });
    return response.ok;
  },
  handlers: {
    failure: () => {
      // Действия при невозможности обновить токен
      router.push('/login');
    }
  }
}, axiosInstance);
```

### Apollo Token Renewal

```typescript
import { createTokenRenewalLink } from '@packages/apollo-token-renewal';

const tokenRenewalLink = createTokenRenewalLink({
  refresh: async () => {
    // Ваша логика обновления токена
    const response = await fetch('/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    });
    return response.ok;
  },
  handlers: {
    failure: () => {
      // Действия при невозможности обновить токен
      router.push('/login');
    }
  }
});

const apolloClient = new ApolloClient({
  link: ApolloLink.from([tokenRenewalLink, httpLink]),
  cache: new InMemoryCache()
});
```

## Особенности реализации

1. **Единственный refresh запрос**: При множественных 401 ошибках выполняется только один запрос на обновление токена
2. **Сохранение контекста**: Все оригинальные параметры запросов сохраняются и используются при повторе
3. **Поддержка отмены**: Отменённые запросы корректно обрабатываются и не повторяются
4. **TypeScript**: Полная типизация для удобной интеграции

## Документация

Подробная документация находится в папке [docs/](./docs/):

- [Тестовые сценарии](./docs/test-cases.md)
- [Архитектура](./docs/architecture.md)
- [Руководство по интеграции](./docs/integration-guide.md)

## Лицензия

MIT
