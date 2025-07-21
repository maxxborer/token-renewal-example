const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
} as const;

export type LogLevel = typeof LOG_LEVELS[keyof typeof LOG_LEVELS];

export const loggerEmojis: Record<LogLevel, string> = {
  [LOG_LEVELS.DEBUG]: '🐛',
  [LOG_LEVELS.INFO]: 'ℹ️',
  [LOG_LEVELS.WARN]: '⚠️',
  [LOG_LEVELS.ERROR]: '❌',
};

export function createLogger(name: string) {
  return {
    debug: (...data: unknown[]) => baseLogging(LOG_LEVELS.DEBUG, name, data),
    info: (...data: unknown[]) => baseLogging(LOG_LEVELS.INFO, name, data),
    warn: (...data: unknown[]) => baseLogging(LOG_LEVELS.WARN, name, data),
    error: (...data: unknown[]) => baseLogging(LOG_LEVELS.ERROR, name, data),
  };
}

function baseLogging(type: LogLevel, name: string, data: unknown[]) {
  console[type](`${loggerEmojis[type]} [${name}]`, ...data);
}
