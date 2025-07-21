import { Request, Response } from 'express';

export interface Context {
  req: Request;
  res: Response;
  isAuthenticated: boolean;
}

export interface AuthRequest extends Request {
  isAuthenticated?: boolean;
}

export enum TokenType {
  TOKEN_1 = 'demo-token-1',
  TOKEN_2 = 'demo-token-2'
}

export interface TokenState {
  canRefresh: boolean;
  getCurrentToken(): string;
  isValidToken(token: string): boolean;
  switchToken(): string;
  reset(): void;
  expireSoft(): void;
  expireHard(): void;
}
