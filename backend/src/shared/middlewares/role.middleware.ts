import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';

export type UserRole = 'fornecedor';

export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role;

    if (!role) {
      return res.status(401).json({ success: false, message: 'Usuario nao autenticado' });
    }

    if (!roles.includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Permissao insuficiente para acessar este recurso',
      });
    }

    return next();
  };
}
