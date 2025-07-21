# Token Renewal Demo Server

Простой сервер для демонстрации работы с обновлением токенов.

## Установка и запуск

```bash
npm install
npm run dev
```

## API

### Авторизация

- `POST /auth/login` - вход (username: demo, password: demo)
- `POST /auth/refresh` - обновление токена
- `POST /auth/logout` - выход
- `POST /auth/expire/soft` - "слабое" протухание токена (можно обновить)
- `POST /auth/expire/hard` - "сильное" протухание токена (нужен повторный вход)

### REST API (требует авторизации)

- `GET /api/users` - список пользователей
- `GET /api/users/:id` - пользователь по ID
- `GET /api/products` - список продуктов
- `POST /api/test` - тестовый POST запрос

### GraphQL

Эндпоинт: `http://localhost:3000/graphql`

Запросы:

- `hello` - публичный запрос
- `users`, `user(id)`, `products`, `currentUser` - требуют авторизации

## Как работает

1. При логине устанавливается cookie с токеном
2. Сервер хранит два токена и переключается между ними при refresh
3. Можно эмулировать "протухание" токена для тестирования
