import { Router } from 'express';
import { tokenState } from '../config/tokens';

export const authRouter = Router();

// Логин
authRouter.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Простая проверка для демо
  if (username === 'demo' && password === 'demo') {
    tokenState.reset();
    const token = tokenState.getCurrentToken();

    res.cookie('authToken', token, {
      httpOnly: true,
      secure: false, // для локальной разработки
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 часа
    });

    res.json({
      success: true,
      username,
      message: 'Logged in successfully'
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
});

// Обновление токена
authRouter.post('/refresh', (req, res) => {
  const token = req.cookies?.authToken;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token provided'
    });
  }

  if (!tokenState.canRefresh) {
    return res.status(401).json({
      success: false,
      message: 'Token cannot be refreshed, please login again'
    });
  }

  // Переключаем токен
  const newToken = tokenState.switchToken();

  res.cookie('authToken', newToken, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  });

  res.json({
    success: true,
    message: 'Token refreshed successfully'
  });
});

// Выход
authRouter.post('/logout', (req, res) => {
  res.clearCookie('authToken');
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Управление состоянием токена (для демо)
authRouter.post('/expire/:type', (req, res) => {
  const { type } = req.params;

  if (type === 'soft') {
    tokenState.expireSoft();
    res.json({
      success: true,
      message: 'Token expired (soft) - can be refreshed'
    });
  } else if (type === 'hard') {
    tokenState.expireHard();
    res.json({
      success: true,
      message: 'Token expired (hard) - re-authentication required'
    });
  } else {
    res.status(400).json({
      success: false,
      message: 'Invalid expiration type'
    });
  }
});
