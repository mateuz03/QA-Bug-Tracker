import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError } from '../utils/http-error.js';

type TokenPayload = { id: number; email: string; role: Role };

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const [scheme, token] = req.headers.authorization?.split(' ') ?? [];

  if (scheme !== 'Bearer' || !token) {
    return next(new HttpError(401, 'Autenticação necessária.'));
  }

  try {
    req.user = jwt.verify(token, config.jwtSecret) as TokenPayload;
    return next();
  } catch {
    return next(new HttpError(401, 'Sessão inválida ou expirada.'));
  }
}

export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new HttpError(403, 'Você não tem permissão para esta ação.'));
    }
    return next();
  };
}
