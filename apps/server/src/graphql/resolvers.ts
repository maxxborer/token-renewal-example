import { Context } from '../types';
import { GraphQLError } from 'graphql';

// Тестовые данные (те же, что и в REST API)
const testData = {
  users: [
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com' }
  ],
  products: [
    { id: 1, name: 'Laptop', price: 999.99 },
    { id: 2, name: 'Mouse', price: 29.99 },
    { id: 3, name: 'Keyboard', price: 79.99 }
  ]
};

export const resolvers = {
  Query: {
    // Публичный запрос
    hello: () => 'Hello from GraphQL!',

    // Защищенные запросы
    users: async (_: unknown, __: unknown, context: Context) => {
      if (!context.isAuthenticated) {
        throw new GraphQLError('Authentication required', {
          extensions: {
            code: 'UNAUTHENTICATED',
            http: { status: 401 }
          }
        });
      }

      // Добавляем задержку для тестирования отмены (если запрошено)
      const req = context.req;
      console.log('GraphQL users resolver - headers:', req?.headers);
      if (req && req.headers && req.headers['x-test-delay'] === 'true') {
        console.log('GraphQL users resolver - adding delay...');
        await new Promise(resolve => setTimeout(resolve, 800));
        console.log('GraphQL users resolver - delay finished');
      }

      return testData.users;
    },

    user: (_: unknown, args: { id: number }, context: Context) => {
      if (!context.isAuthenticated) {
        throw new GraphQLError('Authentication required', {
          extensions: {
            code: 'UNAUTHENTICATED',
            http: { status: 401 }
          }
        });
      }
      return testData.users.find(u => u.id === args.id);
    },

    products: (_: unknown, __: unknown, context: Context) => {
      if (!context.isAuthenticated) {
        throw new GraphQLError('Authentication required', {
          extensions: {
            code: 'UNAUTHENTICATED',
            http: { status: 401 }
          }
        });
      }
      return testData.products;
    },

    currentUser: (_: unknown, __: unknown, context: Context) => {
      if (!context.isAuthenticated) {
        throw new GraphQLError('Authentication required', {
          extensions: {
            code: 'UNAUTHENTICATED',
            http: { status: 401 }
          }
        });
      }
      // Возвращаем первого пользователя для демо
      return testData.users[0];
    },

    // Тестовый запрос для демонстрации GraphQL ошибки авторизации
    testAuthError: () => {
      throw new GraphQLError('This endpoint always returns UNAUTHENTICATED error for testing', {
        extensions: {
          code: 'UNAUTHENTICATED',
          http: { status: 401 }
        }
      });
    }
  },

  Mutation: {
    testMutation: (_: unknown, args: { input: string }, context: Context) => {
      if (!context.isAuthenticated) {
        throw new GraphQLError('Authentication required', {
          extensions: {
            code: 'UNAUTHENTICATED',
            http: { status: 401 }
          }
        });
      }
      return `Received: ${args.input}`;
    }
  }
};
