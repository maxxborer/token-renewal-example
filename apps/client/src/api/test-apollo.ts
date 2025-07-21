import { ApolloQueryResult, FetchResult, gql, MaybeMasked } from '@apollo/client/core';
import { apolloClient } from './apollo';

interface TestResult {
  success: boolean;
  message: string;
  operation?: string;
}

// GraphQL запросы
const USERS_QUERY = gql`
  query GetUsers {
    users {
      id
      name
      email
    }
  }
`;

const PRODUCTS_QUERY = gql`
  query GetProducts {
    products {
      id
      name
      price
    }
  }
`;

const TEST_MUTATION = gql`
  mutation TestMutation($input: String!) {
    testMutation(input: $input)
  }
`;

const TEST_AUTH_ERROR_QUERY = gql`
  query TestAuthError {
    testAuthError
  }
`;

export const testApolloRequests = {
  // Query запрос
  async query(): Promise<TestResult> {
    try {
      const { data } = await apolloClient.query({
        query: USERS_QUERY,
        fetchPolicy: 'network-only'
      });

      return {
        success: true,
        message: `Получено ${data.users.length} пользователей через GraphQL`,
        operation: 'Query GetUsers'
      };
    } catch (error: unknown) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Ошибка запроса',
        operation: 'Query GetUsers'
      };
    }
  },

  // Mutation запрос
  async mutation(): Promise<TestResult> {
    try {
      const { data } = await apolloClient.mutate({
        mutation: TEST_MUTATION,
        variables: {
          input: `Test at ${new Date().toISOString()}`
        }
      });

      return {
        success: true,
        message: data.testMutation,
        operation: 'Mutation TestMutation'
      };
    } catch (error: unknown) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Ошибка запроса',
        operation: 'Mutation TestMutation'
      };
    }
  },

  // Параллельные запросы
  async parallel(): Promise<TestResult[]> {
    const requests = [
      getDelayedRequest(0, () => apolloClient.query({ query: USERS_QUERY, variables: { delay: false }, fetchPolicy: 'network-only' })),
      getDelayedRequest(100, () => apolloClient.query({ query: PRODUCTS_QUERY, fetchPolicy: 'network-only' })),
      getDelayedRequest(200, () => apolloClient.mutate({ mutation: TEST_MUTATION, variables: { input: 'Parallel test' } })),
    ];

    const results: TestResult[] = [];

    try {
      const responses = await Promise.allSettled(requests);

      responses.forEach((response, index) => {
        const operation = index === 0 ? 'Query GetUsers' :
                         index === 1 ? 'Query GetProducts' :
                         'Mutation TestMutation';

        if (response.status === 'fulfilled') {
          const data = response.value.data;
          let message = '';

          if (index === 0) {
            message = `Получено ${data.users.length} пользователей`;
          } else if (index === 1) {
            message = `Получено ${data.products.length} продуктов`;
          } else {
            message = data.testMutation;
          }

          results.push({
            success: true,
            message,
            operation
          });
        } else {
          results.push({
            success: false,
            message: response.reason.message || 'Ошибка запроса',
            operation
          });
        }
      });
    } catch (error: unknown) {
      results.push({
        success: false,
        message: 'Ошибка выполнения параллельных запросов',
        operation: 'PARALLEL GraphQL'
      });
    }

    return results;
  },

  // Тест GraphQL ошибки авторизации
  async testAuthError(): Promise<TestResult> {
    try {
      await apolloClient.query({
        query: TEST_AUTH_ERROR_QUERY,
        fetchPolicy: 'network-only'
      });

      return {
        success: false,
        message: 'Ошибка не была получена (это неожиданно)',
        operation: 'Query TestAuthError'
      };
    } catch (error: unknown) {
      console.log('GraphQL Auth Error test:', error);

      // Проверяем, была ли ошибка корректно обработана token renewal link
      if (error instanceof Error) {
        return {
          success: true,
          message: `GraphQL ошибка авторизации обработана: ${error.message}`,
          operation: 'Query TestAuthError'
        };
      }

      return {
        success: false,
        message: 'Неизвестная ошибка',
        operation: 'Query TestAuthError'
      };
    }
  },

    // Тест отмены запроса
  async cancel(): Promise<TestResult> {
    const controller = new AbortController();

    try {
      console.log('Начинаем Apollo запрос с отменой...');

      // Отменяем запрос через 200мс (до завершения задержки в 800мс)
      setTimeout(() => {
        console.log('Отменяем Apollo запрос...');
        controller.abort();
      }, 200);

      // Делаем запрос с AbortController и задержкой
      console.log('Отправляем Apollo запрос...');
      await apolloClient.query({
        query: USERS_QUERY,
        fetchPolicy: 'network-only',
        context: {
          fetchOptions: {
            signal: controller.signal
          },
          headers: {
            'X-Test-Delay': 'true' // Активируем задержку на сервере
          }
        }
      });

      console.log('Apollo запрос завершился без отмены');
      return {
        success: false,
        message: 'GraphQL запрос не был отменён',
        operation: 'Query GetUsers (should cancel)'
      };
    } catch (error: unknown) {
      console.log('Apollo cancel error:', error);
      if (error instanceof Error && (
        error.name === 'AbortError' ||
        error.message.includes('abort') ||
        error.message.includes('fetch') ||
        error.message.includes('Request aborted')
      )) {
        console.log('Apollo запрос успешно отменен');
        return {
          success: true,
          message: 'GraphQL запрос успешно отменён',
          operation: 'Query GetUsers (cancelled)'
        };
      }
      console.log('Apollo запрос не был отменен, другая ошибка');
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Ошибка запроса',
        operation: 'Query GetUsers'
      };
    }
  }
};

type ApolloReq = () => (Promise<ApolloQueryResult<any>> | Promise<FetchResult<MaybeMasked<any>>>);

const _DISABLE_DELAY = false;

function getDelayedRequest(delay: number, req: ApolloReq): ReturnType<ApolloReq> {
  if (_DISABLE_DELAY) {
    return req();
  }

  return new Promise((resolve) => setTimeout(() => resolve(req()), delay));
}
