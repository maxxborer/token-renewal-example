# Архитектура Token Renewal

## Обзор

Система автоматического обновления токенов состоит из трёх основных компонентов:

1. **Interceptor/Link** - перехватывает 401 ошибки
2. **Queue Manager** - управляет очередью запросов
3. **Token Refresher** - выполняет обновление токена

## Диаграммы

### Общий поток работы

```mermaid
sequenceDiagram
    participant U as User
    participant A as App
    participant I as Interceptor
    participant Q as Queue
    participant R as Refresher
    participant S as Server

    U->>A: Выполнить действие
    A->>I: HTTP запрос
    I->>S: Отправка запроса
    S-->>I: 401 Unauthorized

    I->>I: Проверка: первый 401?
    alt Первый 401
        I->>R: Запустить refresh
        I->>Q: Добавить в очередь
        R->>S: POST /auth/refresh
        S-->>R: Новый токен
        R->>Q: Обработать очередь
        Q->>I: Повторить запросы
        I->>S: Запросы с новым токеном
        S-->>I: Успешные ответы
    else Уже идёт refresh
        I->>Q: Добавить в очередь
        Note over Q: Ждём завершения refresh
    end

    I-->>A: Результат
    A-->>U: Отобразить данные
```

### Обработка параллельных запросов

```mermaid
graph TD
    A[Запрос 1] -->|401| I[Interceptor]
    B[Запрос 2] -->|401| I
    C[Запрос 3] -->|401| I

    I --> D{Refresh активен?}

    D -->|Нет| E[Запустить Refresh]
    D -->|Да| F[Добавить в очередь]

    E --> G[Token Refresh]
    F --> H[Queue]

    G -->|Успех| J[Обработать очередь]
    G -->|Ошибка| K[Отклонить все]

    J --> L[Повторить запрос 1]
    J --> M[Повторить запрос 2]
    J --> N[Повторить запрос 3]

    K --> O[Redirect to Login]
```

### Состояния системы

```mermaid
stateDiagram-v2
    [*] --> Idle: Инициализация

    Idle --> Refreshing: Получен 401
    Refreshing --> Idle: Refresh успешен
    Refreshing --> Failed: Refresh неудачен
    Failed --> [*]: Logout

    state Refreshing {
        [*] --> SendingRefresh
        SendingRefresh --> ProcessingQueue: Токен получен
        ProcessingQueue --> RetryingRequests
        RetryingRequests --> [*]
    }
```

### Структура очереди запросов

```mermaid
classDiagram
    class PendingRequest {
        +resolve: Function
        +reject: Function
        +config: RequestConfig
    }

    class RequestQueue {
        -items: PendingRequest[]
        +add(request): void
        +remove(request): void
        +processAll(error?): void
        +clear(): void
    }

    class TokenRefresher {
        -isRefreshing: boolean
        -queue: RequestQueue
        +refresh(): Promise~boolean~
        +handleAuthError(request): Promise
    }

    RequestQueue "1" --* "*" PendingRequest
    TokenRefresher "1" --> "1" RequestQueue
```

## Детали реализации

### 1. Axios Interceptor

```typescript
// Упрощённая схема работы
interceptor.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      if (!isRefreshing) {
        isRefreshing = true
        return refreshAndRetry(error.config)
      } else {
        return queueRequest(error.config)
      }
    }
    return Promise.reject(error)
  }
)
```

### 2. Apollo Link

```typescript
// Упрощённая схема работы
new ApolloLink((operation, forward) => {
  return new Observable(observer => {
    forward(operation).subscribe({
      error: (error) => {
        if (isAuthError(error)) {
          handleAuthError(operation, observer)
        } else {
          observer.error(error)
        }
      }
    })
  })
})
```

## Ключевые особенности

### Синхронизация

- **Единственный refresh**: Использование флага `isRefreshing` гарантирует только один запрос обновления
- **Очередь запросов**: Все 401 запросы во время refresh добавляются в очередь
- **Атомарность**: Либо все запросы успешны, либо все отклонены

### Сохранение контекста

- **Конфигурация запроса**: Полностью сохраняется для повтора
- **Headers**: Все заголовки переносятся в повторный запрос
- **Body/Payload**: Данные запроса сохраняются без изменений

### Обработка ошибок

- **Graceful degradation**: При невозможности refresh - редирект на login
- **Отмена запросов**: Поддержка AbortController
- **Timeout**: Защита от бесконечного ожидания

## Метрики и мониторинг

### Важные метрики

1. **Refresh Rate**: Количество refresh в единицу времени
2. **Queue Size**: Размер очереди ожидающих запросов
3. **Success Rate**: Процент успешных refresh
4. **Latency**: Время от 401 до успешного повтора

### Точки логирования

```mermaid
graph LR
    A[401 получен] -->|log| B[Refresh запущен]
    B -->|log| C[Токен обновлён]
    C -->|log| D[Очередь обработана]
    D -->|log| E[Запросы повторены]

    B -->|error log| F[Refresh failed]
    F -->|log| G[User logged out]
```

## Безопасность

### Защитные механизмы

1. **Ограничение попыток**: Только один retry после refresh
2. **Валидация токена**: Проверка на сервере независимо от клиента
3. **Изоляция контекста**: Каждый запрос имеет свой контекст
4. **Timeout protection**: Защита от долгих refresh

### Потенциальные уязвимости

- **Race conditions**: Решены через единую очередь
- **Token leakage**: Токены только в httpOnly cookies
- **CSRF**: Защита через SameSite cookies
- **XSS**: Экранирование всех выводимых данных
