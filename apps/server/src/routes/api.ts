import { type NextFunction, type Request, type Response, Router } from 'express';
import { authMiddleware } from '../middleware/auth';

export const apiRouter = Router();

// Middleware для проверки авторизации
apiRouter.use(authMiddleware);

// Middleware для добавления задержки (для демонстрации отмены запросов)
const addDelay = (delayMs: number = 800) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    // Если это тест отмены, добавляем задержку
    const isTestCancellation = req.query.delay === 'true';

    if (isTestCancellation) {
      setTimeout(() => {
        next();
      }, delayMs);
    } else {
      next();
    }
  };
};

// Тестовые данные
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

// GET /api/users
apiRouter.get('/users', addDelay(), (req, res) => {
  res.json({
    success: true,
    data: testData.users,
    timestamp: new Date().toISOString()
  });
});

// GET /api/users/:id
apiRouter.get('/users/:id', (req, res) => {
  const user = testData.users.find(u => u.id === parseInt(req.params.id));

  if (user) {
    res.json({
      success: true,
      data: user,
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }
});

// GET /api/products
apiRouter.get('/products', (req, res) => {
  res.json({
    success: true,
    data: testData.products,
    timestamp: new Date().toISOString()
  });
});

// POST /api/test - для тестирования POST запросов
apiRouter.post('/test', (req, res) => {
  res.json({
    success: true,
    message: 'POST request successful',
    received: req.body,
    timestamp: new Date().toISOString()
  });
});
