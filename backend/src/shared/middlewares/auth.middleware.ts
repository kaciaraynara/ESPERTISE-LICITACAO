import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../runtime-config';
import { logAuthEvent, normalizeAuthEmail } from '../../services/auth.service';
import { prisma } from '../../database/prisma';

export interface AuthRequest extends Request {
  companyId?: string;
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
    role?: 'fornecedor' | 'admin' | 'super_admin';
    isAdmin?: boolean;
    permissions?: string[];
    companyId?: string | null;
    isTrialActive?: boolean;
    trialEndsAt?: string | null;
  };
}

/**
 * Resolve a empresa ativa autorizada para o usuário, respeitando o header x-company-id
 * ou companyId explícito apenas se pertencer ao userId autenticado (proteção contra IDOR).
 */
export async function resolveAuthorizedCompany(userId: string, preferredCompanyId?: string | null) {
  if (preferredCompanyId && typeof preferredCompanyId === 'string' && preferredCompanyId.trim()) {
    const requested = await prisma.company.findFirst({
      where: {
        id: preferredCompanyId.trim(),
        userId,
      },
    });
    return requested;
  }

  return prisma.company.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });
}

function getExplicitCompanyValues(req: AuthRequest): unknown[] {
  const body = req.body as Record<string, unknown> | undefined;
  const query = req.query as Record<string, unknown>;
  return [
    req.headers['x-company-id'],
    body?.companyId,
    body?.empresaId,
    body?.empresa_id,
    query.companyId,
    query.empresaId,
    query.empresa_id,
  ];
}

function getExplicitCompanyIds(values: unknown[]) {
  return values
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim());
}

export async function companyContextMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Usuário não autenticado.',
    });
  }

  const explicitCompanyValues = getExplicitCompanyValues(req);
  if (explicitCompanyValues.some((value) => value !== undefined && value !== null && typeof value !== 'string')) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_COMPANY_CONTEXT',
      message: 'O identificador da empresa deve ser informado em formato válido.',
    });
  }

  const explicitCompanyIds = getExplicitCompanyIds(explicitCompanyValues);
  const uniqueCompanyIds = [...new Set(explicitCompanyIds)];
  if (uniqueCompanyIds.length > 1) {
    return res.status(403).json({
      success: false,
      code: 'COMPANY_CONTEXT_MISMATCH',
      message: 'A empresa informada não corresponde à empresa ativa.',
    });
  }

  const requestedCompanyId =
    uniqueCompanyIds[0] || req.user.companyId || undefined;

  try {
    const company = requestedCompanyId
      ? await prisma.company.findFirst({
          where: {
            id: requestedCompanyId,
            userId: req.user.id,
            tenantId: req.user.tenantId,
          },
        })
      : await prisma.company.findFirst({
          where: {
            userId: req.user.id,
            tenantId: req.user.tenantId,
          },
          orderBy: { createdAt: 'asc' },
        });

    if (requestedCompanyId && !company) {
      return res.status(403).json({
        success: false,
        code: 'COMPANY_ACCESS_DENIED',
        message: 'A empresa selecionada não está disponível para este usuário.',
      });
    }

    req.companyId = company?.id;
    return next();
  } catch (error) {
    return next(error);
  }
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
  const [scheme, credential] = req.headers.authorization?.trim().split(/\s+/, 2) ?? [];
  const bearerToken = scheme?.toLowerCase() === 'bearer' ? credential : undefined;
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

    const rawRole = typeof decoded.role === 'string' ? decoded.role.toLowerCase() : 'fornecedor';
    const role: 'fornecedor' | 'admin' | 'super_admin' =
      rawRole === 'admin' || rawRole === 'super_admin' ? rawRole : 'fornecedor';

    const permissions = Array.isArray(decoded.permissions)
      ? decoded.permissions.filter((permission: unknown): permission is string => typeof permission === 'string')
      : typeof decoded.scope === 'string'
        ? decoded.scope.split(/\s+/).filter(Boolean)
        : [];

    const headerCompanyId = req.headers['x-company-id'];
    if (typeof headerCompanyId === 'string' && headerCompanyId.trim()) {
      req.companyId = headerCompanyId.trim();
    }

    const rawTrialEndsAt = decoded.trialEndsAt || decoded.trial_ends_at;
    const isTrialActive = Boolean(
      decoded.isTrialActive === true ||
      (rawTrialEndsAt && new Date(rawTrialEndsAt) > new Date())
    );
    const effectivePlan = isTrialActive ? 'master' : decoded.plano;

    req.user = {
      id: decoded.id,
      tenantId: decoded.tenant_id,
      email: normalizeAuthEmail(decoded.email),
      nome: decoded.nome ?? null,
      telefone: decoded.telefone ?? null,
      plano: effectivePlan,
      email_verificado: decoded.email_verificado ?? true,
      ultimo_acesso: decoded.ultimo_acesso ?? null,
      created_at: decoded.created_at ?? undefined,
      role,
      companyId: typeof decoded.company_id === 'string' ? decoded.company_id : null,
      isAdmin:
        decoded.is_admin === true ||
        decoded.admin === true ||
        role === 'admin' ||
        role === 'super_admin' ||
        permissions.includes('data_platform:admin'),
      permissions,
      isTrialActive,
      trialEndsAt: rawTrialEndsAt ? new Date(rawTrialEndsAt).toISOString() : null,
    };
    return next();
  } catch {
    void logAuthEvent('TOKEN_INVALID', { reason: 'access_token_verify_failed', ...getAuditContext(req) });
    return res.status(401).json({ success: false, message: 'Token de autenticação inválido ou expirado' });
  }
};
