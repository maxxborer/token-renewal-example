import { ApolloClient, InMemoryCache, createHttpLink, ApolloLink } from '@apollo/client/core';
import { createTokenRenewalLink } from '@packages/apollo-token-renewal';
import { onRefreshFailed, refresh } from './refresh';

const operationNameLink = new ApolloLink((operation, forward) => {
  const opName = operation.operationName;
  const separator = '/graphql'.includes('?') ? '&' : '?';
  const uriWithOpName = `/graphql${separator}${new URLSearchParams({ opName })}`;
  operation.setContext({ uri: uriWithOpName });
  return forward(operation);
});

// Link для передачи custom заголовков
const headersLink = new ApolloLink((operation, forward) => {
  const context = operation.getContext();
  const customHeaders = context.fetchOptions?.headers || context.headers || {};
  operation.setContext({ headers: { ...context.headers, ...customHeaders }});
  return forward(operation);
});

// HTTP Link
const httpLink = createHttpLink({ uri: '/graphql', credentials: 'include' });

// Token Renewal Link
const tokenRenewalLink = createTokenRenewalLink({
  refresh,
  handlers: { failure: onRefreshFailed },
  flagKeys: {
    retry: '_retry',
    skipAuth: '_skipAuth'
  },
  isAuthError: (error) => {
    // Проверяем network error на статус 401
    const hasNetworkAuth = Boolean(
      error.networkError &&
      'statusCode' in error.networkError &&
      error.networkError.statusCode === 401
    );

    // Проверяем graphQLErrors на UNAUTHENTICATED ошибку
    const hasGraphQLAuth = error.graphQLErrors?.some(gqlError =>
      gqlError.extensions?.code === 'UNAUTHENTICATED' ||
      gqlError.message?.includes('Unauthorized') ||
      gqlError.message?.includes('UNAUTHENTICATED')
    ) || false;

    return hasNetworkAuth || hasGraphQLAuth;
  }
});

// Создаём Apollo Client
export const apolloClient = new ApolloClient({
  link: ApolloLink.from([tokenRenewalLink, headersLink, operationNameLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network'
    }
  }
});
