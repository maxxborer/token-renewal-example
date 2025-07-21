import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { typeDefs } from './graphql/schema';
import { resolvers } from './graphql/resolvers';
import { authRouter } from './routes/auth';
import { apiRouter } from './routes/api';
import { authMiddleware } from './middleware/auth';
import type { Context } from './types';

const app = express();
const PORT = 3000;

async function startServer() {
  // Middleware
  app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
  }));
  app.use(cookieParser());
  app.use(express.json());

  // Routes
  app.use('/auth', authRouter);
  app.use('/api', authMiddleware, apiRouter);

  // GraphQL
  const apolloServer = new ApolloServer<Context>({
    typeDefs,
    resolvers,
  });

  await apolloServer.start();

  app.use(
    '/graphql',
    expressMiddleware(apolloServer, {
      context: async ({ req, res }: { req: express.Request; res: express.Response }): Promise<Context> => {
        const isAuthenticated = authMiddleware(req, res);
        return {
          req,
          res,
          isAuthenticated
        };
      }
    })
  );

  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`🚀 GraphQL endpoint: http://localhost:${PORT}/graphql`);
  });
}

startServer().catch(console.error);
