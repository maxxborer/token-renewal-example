# Документация Token Renewal

Добро пожаловать в документацию системы автоматического обновления токенов!

## Содержание

### 📋 [test-cases.md](./test-cases.md)

Подробные тестовые сценарии для проверки всех возможностей системы:

- Базовые сценарии (успешный/неудачный refresh)
- Параллельные запросы
- Отмена запросов
- Edge cases и специфичные сценарии
- Тесты производительности и безопасности

### 🏗️ [architecture.md](./architecture.md)

Архитектурное описание системы с диаграммами:

- Общий поток работы
- Обработка параллельных запросов
- Состояния системы
- Детали реализации для Axios и Apollo
- Метрики и мониторинг

### 🚀 [integration-guide.md](./integration-guide.md)

Практическое руководство по интеграции:

- Быстрый старт для Axios и Apollo
- Best practices
- Примеры кода для различных сценариев
- Чеклист интеграции
- Решение частых проблем

## Быстрые ссылки

### Для разработчиков

1. Начните с [integration-guide.md](./integration-guide.md) для быстрой интеграции
2. Изучите [architecture.md](./architecture.md) для понимания внутренней работы
3. Используйте [test-cases.md](./test-cases.md) для тестирования

### Для QA

1. [test-cases.md](./test-cases.md) - все сценарии для тестирования
2. Раздел "Метрики и мониторинг" в [architecture.md](./architecture.md)

### Для DevOps

1. Раздел "Мониторинг и аналитика" в [integration-guide.md](./integration-guide.md)
2. Раздел "Безопасность" в [architecture.md](./architecture.md)

## Дополнительные ресурсы

- [Демо приложение](../README.md)
- [Пакет для Axios](../packages/axios-token-renewal/README.md)
- [Пакет для Apollo](../packages/apollo-token-renewal/README.md)
- [Пакет для логирования](../packages/simple-logger/README.md)

## Вопросы и ответы

### Почему не использовать refresh в Authorization header?

Использование cookies обеспечивает:

- Автоматическую отправку с каждым запросом
- Защиту от XSS (httpOnly)
- Защиту от CSRF (SameSite)
- Работу с credentials в CORS

### Как обрабатывать refresh token rotation?

Сервер может возвращать новый refresh token при каждом обновлении:

```typescript
// На клиенте обновление происходит автоматически через cookies
const response = await fetch('/auth/refresh', {
  credentials: 'include' // cookies отправляются автоматически
});
```

### Как отладить проблемы с token renewal?

1. Включите debug логирование
2. Проверьте Network вкладку в DevTools
3. Убедитесь, что cookies правильно установлены
4. Проверьте CORS настройки

## Поддержка

Если у вас есть вопросы или предложения:

1. Создайте issue в репозитории
2. Предложите улучшения через pull request
3. Поделитесь своим опытом использования
