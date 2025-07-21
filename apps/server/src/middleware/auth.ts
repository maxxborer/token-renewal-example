import { Request, Response, NextFunction } from 'express';
import { tokenState } from '../config/tokens';
import { AuthRequest } from '../types';

export const authMiddleware = (
  req: Request | AuthRequest,
  res?: Response,
  next?: NextFunction
): boolean => {
  const token = req.cookies?.authToken;

  // Если токен валидный - пропускаем
  if (token && tokenState.isValidToken(token)) {
    (req as AuthRequest).isAuthenticated = true;
    if (next) next();
    return true;
  }

  // Если токена нет или он невалидный - возвращаем 401
  if (res && !res.headersSent) {
    res.status(401).json({
      error: 'Unauthorized',
      canRefresh: tokenState.canRefresh
    });
  }
  return false;
};
