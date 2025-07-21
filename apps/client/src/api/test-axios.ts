import { AxiosResponse } from 'axios';
import axiosInstance from './axios';

interface TestResult {
  success: boolean;
  message: string;
  method?: string;
  url?: string;
}

export const testAxiosRequests = {
  // Простой GET запрос
  async get(): Promise<TestResult> {
    try {
      const response = await axiosInstance.get('/api/users');
      return {
        success: true,
        message: `Получено ${response.data.data.length} пользователей`,
        method: 'GET',
        url: '/api/users'
      };
    } catch (error: unknown) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Ошибка запроса',
        method: 'GET',
        url: '/api/users'
      };
    }
  },

  // POST запрос
  async post(): Promise<TestResult> {
    try {
      const response = await axiosInstance.post('/api/test', {
        test: 'data',
        timestamp: new Date().toISOString()
      });
      return {
        success: true,
        message: response.data.message,
        method: 'POST',
        url: '/api/test'
      };
    } catch (error: unknown) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Ошибка запроса',
        method: 'POST',
        url: '/api/test'
      };
    }
  },

  // Параллельные запросы
  async parallel(): Promise<TestResult[]> {
    const requests = [
      getDelayedRequest(0, () => axiosInstance.get('/api/users')),
      getDelayedRequest(100, () => axiosInstance.get('/api/products')),
      getDelayedRequest(200, () => axiosInstance.post('/api/test', { parallel: true }))
    ];

    const results: TestResult[] = [];

    try {
      const responses = await Promise.allSettled(requests);

      responses.forEach((response, index) => {
        const isGet = index < 2;
        const url = index === 0 ? '/api/users' : index === 1 ? '/api/products' : '/api/test';
        const method = isGet ? 'GET' : 'POST';

        if (response.status === 'fulfilled') {
          results.push({
            success: true,
            message: isGet
              ? `Получено ${response.value.data.data.length} записей`
              : response.value.data.message,
            method,
            url
          });
        } else {
          results.push({
            success: false,
            message: response.reason.message || 'Ошибка запроса',
            method,
            url
          });
        }
      });
    } catch (error: unknown) {
      results.push({
        success: false,
        message: 'Ошибка выполнения параллельных запросов',
        method: 'PARALLEL',
        url: 'multiple'
      });
    }

    return results;
  },

  // Тест отмены запроса
  async cancel(): Promise<TestResult> {
    const controller = new AbortController();

    try {
      // Отменяем запрос через 200мс (до завершения задержки в 800мс)
      setTimeout(() => {
        console.log('Отменяем Axios запрос...');
        controller.abort();
      }, 200);

      // Делаем запрос с задержкой на сервере
      await axiosInstance.get('/api/users', {
        signal: controller.signal,
        params: { delay: 'true' } // Активируем задержку на сервере
      });

      return {
        success: false,
        message: 'Запрос не был отменён',
        method: 'GET',
        url: '/api/users'
      };
    } catch (error: unknown) {
      console.log('Axios cancel error:', error);
      if (error instanceof Error && (
        error.name === 'CanceledError' ||
        error.name === 'AbortError' ||
        error.message.includes('canceled') ||
        error.message.includes('aborted')
      )) {
        return {
          success: true,
          message: 'Axios запрос успешно отменён',
          method: 'GET',
          url: '/api/users (cancelled)'
        };
      }
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Ошибка запроса',
        method: 'GET',
        url: '/api/users'
      };
    }
  }
};

type AxiosReq = () => Promise<AxiosResponse<any>>;

const _DISABLE_DELAY = false;

function getDelayedRequest(delay: number, req: AxiosReq): ReturnType<AxiosReq> {
  if (_DISABLE_DELAY) {
    return req();
  }

  return new Promise((resolve) => setTimeout(() => resolve(req()), delay));
}
