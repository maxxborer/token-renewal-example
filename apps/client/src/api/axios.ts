import axios from 'axios';
import { setupAxiosTokenRenewal } from '@packages/axios-token-renewal';
import { onRefreshFailed, refresh } from './refresh';

// Создаём инстанс axios
export const axiosInstance = axios.create({
  baseURL: '/',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

// Настраиваем token renewal
export function setupAxios(): void {
  setupAxiosTokenRenewal({
    refresh,
    handlers: { failure: onRefreshFailed },
    flagKeys: {
      retry: '_retry',
      skipAuth: '_skipAuth'
    },
    isAuthError: (error) => Boolean(error.response?.status === 401)
  }, axiosInstance);
}

// Экспортируем axios для использования
export default axiosInstance;
