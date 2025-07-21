export const typeDefs = `#graphql
  type User {
    id: Int!
    name: String!
    email: String!
  }

  type Product {
    id: Int!
    name: String!
    price: Float!
  }

  type AuthPayload {
    success: Boolean!
    message: String!
  }

  type Query {
    # Публичный запрос (не требует авторизации)
    hello: String!

    # Защищенные запросы
    users: [User!]!
    user(id: Int!): User
    products: [Product!]!
    currentUser: User

    # Тестовый запрос для демонстрации GraphQL ошибки авторизации
    testAuthError: String!
  }

  type Mutation {
    # Тестовая мутация
    testMutation(input: String!): String!
  }
`;
