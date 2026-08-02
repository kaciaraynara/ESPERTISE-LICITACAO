import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { RBAC_PERMISSIONS, RbacService } from '../../services/rbac.service';

const rbac = new RbacService();

export async function requireDataPlatformAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  return requirePermission(req, res, next, {
    permission: RBAC_PERMISSIONS.DATA_PLATFORM_ADMIN,
    scope: 'data_platform_admin',
    message: 'Permissao administrativa insuficiente para operar a Data Platform',
    fallback: isDataPlatformAdminFallback,
  });
}

export async function requireRbacAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  return requirePermission(req, res, next, {
    permission: RBAC_PERMISSIONS.USERS_MANAGE,
    scope: 'rbac_admin',
    message: 'Permissao administrativa insuficiente para gerenciar RBAC',
    fallback: isRbacAdminFallback,
  });
}

export async function requireAuditRead(req: AuthRequest, res: Response, next: NextFunction) {
  return requirePermission(req, res, next, {
    permission: RBAC_PERMISSIONS.AUDIT_READ,
    scope: 'audit_admin',
    message: 'Permissao administrativa insuficiente para consultar auditoria',
    fallback: isAuditAdminFallback,
  });
}

export async function requireLegalAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  return requirePermission(req, res, next, {
    permission: RBAC_PERMISSIONS.LEGAL_ADMIN,
    scope: 'legal_rules_admin',
    message: 'Permissao administrativa insuficiente para gerenciar regras juridicas',
    fallback: isLegalAdminFallback,
  });
}

export async function requireLegalReview(req: AuthRequest, res: Response, next: NextFunction) {
  return requirePermission(req, res, next, {
    permission: RBAC_PERMISSIONS.LEGAL_REVIEW,
    scope: 'legal_rules_admin',
    message: 'Permissao insuficiente para revisar regras juridicas',
    fallback: isLegalReviewFallback,
  });
}

export async function requireLegalPublish(req: AuthRequest, res: Response, next: NextFunction) {
  return requirePermission(req, res, next, {
    permission: RBAC_PERMISSIONS.LEGAL_PUBLISH,
    scope: 'legal_rules_admin',
    message: 'Permissao insuficiente para publicar regras juridicas',
    fallback: isLegalPublishFallback,
  });
}

async function requirePermission(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
  options: {
    permission: string;
    scope: string;
    message: string;
    fallback: (req: AuthRequest) => boolean;
  },
) {
  if (!req.user?.id) {
    return res.status(401).json({ success: false, message: 'Usuario nao autenticado' });
  }

  if (await hasPersistentPermission(req, options.permission)) {
    return next();
  }

  if (isEnvFallbackAllowed() && options.fallback(req)) {
    return next();
  }

  await auditAuthorizationFailure(req, options.permission, options.scope);
  return res.status(403).json({
    success: false,
    message: options.message,
  });
}

async function hasPersistentPermission(req: AuthRequest, permission: string) {
  try {
    return await rbac.hasPermission(
      req.user?.id ?? '',
      permission,
      req.user?.tenantId ?? null,
    );
  } catch (_error) {
    return false;
  }
}

function isDataPlatformAdminFallback(req: AuthRequest) {
  const allowlistedUserIds = splitCsv(process.env.DATA_PLATFORM_ADMIN_USER_IDS);
  const allowlistedEmails = splitCsv(process.env.DATA_PLATFORM_ADMIN_EMAILS).map((email) => email.toLowerCase());
  const userEmail = req.user?.email?.toLowerCase();

  return Boolean(
    req.user?.isAdmin
      || req.user?.permissions?.includes('data_platform:admin')
      || (req.user?.id && allowlistedUserIds.includes(req.user.id))
      || (userEmail && allowlistedEmails.includes(userEmail)),
  );
}

function isRbacAdminFallback(req: AuthRequest) {
  const allowlistedUserIds = [
    ...splitCsv(process.env.RBAC_ADMIN_USER_IDS),
    ...splitCsv(process.env.DATA_PLATFORM_ADMIN_USER_IDS),
  ];
  const allowlistedEmails = [
    ...splitCsv(process.env.RBAC_ADMIN_EMAILS),
    ...splitCsv(process.env.DATA_PLATFORM_ADMIN_EMAILS),
  ].map((email) => email.toLowerCase());
  const userEmail = req.user?.email?.toLowerCase();

  return Boolean(
    req.user?.isAdmin
      || req.user?.permissions?.includes(RBAC_PERMISSIONS.USERS_MANAGE)
      || req.user?.permissions?.includes(RBAC_PERMISSIONS.DATA_PLATFORM_ADMIN)
      || (req.user?.id && allowlistedUserIds.includes(req.user.id))
      || (userEmail && allowlistedEmails.includes(userEmail)),
  );
}

function isAuditAdminFallback(req: AuthRequest) {
  const allowlistedUserIds = [
    ...splitCsv(process.env.AUDIT_ADMIN_USER_IDS),
    ...splitCsv(process.env.RBAC_ADMIN_USER_IDS),
    ...splitCsv(process.env.DATA_PLATFORM_ADMIN_USER_IDS),
  ];
  const allowlistedEmails = [
    ...splitCsv(process.env.AUDIT_ADMIN_EMAILS),
    ...splitCsv(process.env.RBAC_ADMIN_EMAILS),
    ...splitCsv(process.env.DATA_PLATFORM_ADMIN_EMAILS),
  ].map((email) => email.toLowerCase());
  const userEmail = req.user?.email?.toLowerCase();

  return Boolean(
    req.user?.isAdmin
      || req.user?.permissions?.includes(RBAC_PERMISSIONS.AUDIT_READ)
      || req.user?.permissions?.includes(RBAC_PERMISSIONS.AUDIT_ADMIN)
      || (req.user?.id && allowlistedUserIds.includes(req.user.id))
      || (userEmail && allowlistedEmails.includes(userEmail)),
  );
}

function isLegalAdminFallback(req: AuthRequest) {
  const allowlistedUserIds = [
    ...splitCsv(process.env.LEGAL_ADMIN_USER_IDS),
    ...splitCsv(process.env.RBAC_ADMIN_USER_IDS),
    ...splitCsv(process.env.DATA_PLATFORM_ADMIN_USER_IDS),
  ];
  const allowlistedEmails = [
    ...splitCsv(process.env.LEGAL_ADMIN_EMAILS),
    ...splitCsv(process.env.RBAC_ADMIN_EMAILS),
    ...splitCsv(process.env.DATA_PLATFORM_ADMIN_EMAILS),
  ].map((email) => email.toLowerCase());
  const userEmail = req.user?.email?.toLowerCase();

  return Boolean(
    req.user?.isAdmin
      || req.user?.permissions?.includes(RBAC_PERMISSIONS.LEGAL_ADMIN)
      || (req.user?.id && allowlistedUserIds.includes(req.user.id))
      || (userEmail && allowlistedEmails.includes(userEmail)),
  );
}

function isLegalReviewFallback(req: AuthRequest) {
  return isLegalRoleFallback(req, RBAC_PERMISSIONS.LEGAL_REVIEW, process.env.LEGAL_REVIEW_USER_IDS, process.env.LEGAL_REVIEW_EMAILS);
}

function isLegalPublishFallback(req: AuthRequest) {
  return isLegalRoleFallback(req, RBAC_PERMISSIONS.LEGAL_PUBLISH, process.env.LEGAL_PUBLISH_USER_IDS, process.env.LEGAL_PUBLISH_EMAILS);
}

function isLegalRoleFallback(req: AuthRequest, permission: string, userIds?: string, emails?: string) {
  const allowlistedUserIds = [
    ...splitCsv(userIds),
    ...splitCsv(process.env.LEGAL_ADMIN_USER_IDS),
    ...splitCsv(process.env.RBAC_ADMIN_USER_IDS),
    ...splitCsv(process.env.DATA_PLATFORM_ADMIN_USER_IDS),
  ];
  const allowlistedEmails = [
    ...splitCsv(emails),
    ...splitCsv(process.env.LEGAL_ADMIN_EMAILS),
    ...splitCsv(process.env.RBAC_ADMIN_EMAILS),
    ...splitCsv(process.env.DATA_PLATFORM_ADMIN_EMAILS),
  ].map((email) => email.toLowerCase());
  const userEmail = req.user?.email?.toLowerCase();

  return Boolean(
    req.user?.isAdmin
      || req.user?.permissions?.includes(permission)
      || (req.user?.id && allowlistedUserIds.includes(req.user.id))
      || (userEmail && allowlistedEmails.includes(userEmail)),
  );
}

function isEnvFallbackAllowed() {
  const nodeEnv = String(process.env.NODE_ENV ?? 'development').toLowerCase();
  if (nodeEnv === 'production') return false;

  const raw = process.env.RBAC_ALLOW_ENV_FALLBACK;
  if (raw === undefined) return nodeEnv === 'test';

  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

async function auditAuthorizationFailure(req: AuthRequest, permission: string, scope: string) {
  try {
    await rbac.auditAuthorizationFailure({
      user: req.user ? {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
      } : null,
      tenantId: req.user?.tenantId ?? null,
      requestId: req.headers['x-request-id'],
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    }, permission, scope, ...(scope === 'legal_rules_admin' ? ['legal_rule_access_denied'] as const : []));
  } catch (_error) {
    // Authorization response must not depend on audit persistence availability.
  }
}

function splitCsv(value: string | undefined) {
  return String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}
