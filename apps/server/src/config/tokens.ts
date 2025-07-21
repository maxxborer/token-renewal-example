import { TokenType, TokenState } from '../types';

// Текущий активный токен
let currentToken: string = TokenType.TOKEN_1;

// Состояние токенов
let isTokenExpired = false;

export const tokenState: TokenState = {
  // Можно ли обновить токен (для "слабого" протухания)
  canRefresh: true,

  // Получить текущий токен
  getCurrentToken(): string {
    return currentToken;
  },

  // Проверить валиден ли токен
  isValidToken(token: string): boolean {
    return !isTokenExpired && token === currentToken;
  },

  // Переключить на другой токен (имитация refresh)
  switchToken(): string {
    currentToken = currentToken === TokenType.TOKEN_1 ? TokenType.TOKEN_2 : TokenType.TOKEN_1;
    isTokenExpired = false; // После обновления токен снова валиден
    console.log(`Token switched to: ${currentToken}`);
    return currentToken;
  },

  // Сбросить на первый токен (после логина)
  reset(): void {
    currentToken = TokenType.TOKEN_1;
    isTokenExpired = false;
    this.canRefresh = true;
    console.log('Token state reset');
  },

  // "Слабое" протухание - можно обновить
  expireSoft(): void {
    isTokenExpired = true; // Помечаем токен как протухший
    this.canRefresh = true;
    console.log('Token expired (soft) - can be refreshed');
  },

  // "Сильное" протухание - нужна повторная авторизация
  expireHard(): void {
    isTokenExpired = true; // Помечаем токен как протухший
    this.canRefresh = false;
    console.log('Token expired (hard) - re-authentication required');
  }
};
