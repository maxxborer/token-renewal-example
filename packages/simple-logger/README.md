# Simple Logger

Простой пакет для логирования с эмодзи и цветным выводом в консоль.

## Установка

```bash
npm install @packages/simple-logger
```

## Использование

```typescript
import { createLogger } from '@packages/simple-logger';

const logger = createLogger('my-module');

logger.debug('Отладочная информация');
logger.info('Информационное сообщение');
logger.warn('Предупреждение');
logger.error('Ошибка');
```

## API

### createLogger(name: string)

Создаёт экземпляр логгера с указанным именем модуля.

**Параметры:**
- `name: string` - имя модуля для отображения в логах

**Возвращает:** объект с методами логирования

### Методы логирования

- `debug(...data: unknown[])` - отладочные сообщения (🐛)
- `info(...data: unknown[])` - информационные сообщения (ℹ️)
- `warn(...data: unknown[])` - предупреждения (⚠️)
- `error(...data: unknown[])` - ошибки (❌)

## Примеры

### Базовое использование

```typescript
import { createLogger } from '@packages/simple-logger';

const logger = createLogger('auth-service');

logger.info('Пользователь вошёл в систему');
logger.warn('Токен истекает через 5 минут');
logger.error('Не удалось обновить токен');
```

### В системе token renewal

```typescript
import { createLogger } from '@packages/simple-logger';

const logger = createLogger('token-renewal');

export class TokenRenewalService {
  async refresh() {
    logger.info('Начинаем обновление токена');

    try {
      const result = await this.performRefresh();
      logger.info('Токен успешно обновлён');
      return result;
    } catch (error) {
      logger.error('Ошибка обновления токена:', error);
      throw error;
    }
  }
}
```

## Особенности

- **Эмодзи индикаторы**: Каждый уровень логирования имеет свой эмодзи
- **Имя модуля**: Все сообщения префиксируются именем модуля
- **Простота**: Минимальный API для быстрого старта
- **TypeScript**: Полная поддержка типов

## Формат вывода

```
ℹ️ [auth-service] Пользователь вошёл в систему
⚠️ [auth-service] Токен истекает через 5 минут
❌ [auth-service] Не удалось обновить токен Error: Network error
```
