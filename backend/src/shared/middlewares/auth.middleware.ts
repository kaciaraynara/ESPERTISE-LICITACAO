import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../runtime-config';
import { logAuthEvent, normalizeAuthEmail } from '../../services/auth.service';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    tenantId: string;
    email: string;
    nome?: string | null;
    telefone?: string | null;
    plano: string;
    email_verificado?: boolean;
    ultimo_acesso?: string | null;
    created_at?: string;
    role?: 'fornecedor';
    isAdmin?: boolean;
    permissions?: string[];
  };
}

function readCookie(req: Request, name: string) {
  const raw = req.headers.cookie;
  if (!raw) return undefined;

  return raw
    .split(';')
    .map((part) => part.trim())
    .map((part) => {
      const separator = part.indexOf('=');
      return separator >= 0 ? [part.slice(0, separator), part.slice(separator + 1)] : [part, ''];
    })
    .find(([key]) => key === name)?.[1];
}

function getAccessToken(req: Request) {
  const authHeader = req.headers.authorization;
  const [, bearerToken] = authHeader?.split(' ') ?? [];
  return bearerToken || readCookie(req, 'expertise_access_token');
}

function getClientIp(req: Request) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
}

function getAuditContext(req: Request) {
  return {
    requestId: req.headers['x-request-id'] || req.headers['x-correlation-id'],
    ip: getClientIp(req),
    userAgent: req.headers['user-agent'],
  };
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = getAccessToken(req);

  if (!token) {
    void logAuthEvent('TOKEN_INVALID', { reason: 'access_token_missing', ...getAuditContext(req) });
    return res.status(401).json({ success: false, message: 'Token de autenticação não fornecido' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as any;

    if (decoded.token_type && decoded.token_type !== 'access') {
      void logAuthEvent('TOKEN_INVALID', { userId: decoded.id, reason: 'wrong_access_token_type', ...getAuditContext(req) });
      return res.status(401).json({ success: false, message: 'Tipo de token inválido para esta operação' });
    }

    if (!decoded.id || !decoded.tenant_id || !decoded.email || !decoded.plano) {
      void logAuthEvent('TOKEN_INVALID', { userId: decoded.id, reason: 'access_token_incomplete', ...getAuditContext(req) });
      return res.status(401).json({ success: false, message: 'Token de autenticação incompleto' });
    }

    const role = 'fornecedor';
    const permissions = Array.isArray(decoded.permissions)
      ? decoded.permissions.filter((permission: unknown): permission is string => typeof permission === 'string')
      : typeof decoded.scope === 'string'
        ? decoded.scope.split(/\s+/).filter(Boolean)
        : [];

    req.user = {
      id: decoded.id,
      tenantId: decoded.tenant_id,
      email: normalizeAuthEmail(decoded.email),
      nome: decoded.nome ?? null,
      telefone: decoded.telefone ?? null,
      plano: decoded.plano,
      email_verificado: decoded.email_verificado ?? true,
      ultimo_acesso: decoded.ultimo_acesso ?? null,
      created_at: decoded.created_at ?? undefined,
      role,
      isAdmin: decoded.is_admin === true || decoded.admin === true || permissions.includes('data_platform:admin'),
      permissions,
    };
    return next();
  } catch {
    void logAuthEvent('TOKEN_INVALID', { reason: 'access_token_verify_failed', ...getAuditContext(req) });
    return res.status(401).json({ success: false, message: 'Token de autenticação inválido ou expirado' });
  }
};
