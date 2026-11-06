import { CookieOptions, NextFunction, Request, RequestHandler, Response, Router } from 'express';
import jwt from 'jsonwebtoken';
import { AuditAdminController } from '../controllers/audit-admin.controller';
import { AuditController } from '../controllers/AuditController';
import { DataPlatformAdminController } from '../controllers/data-platform-admin.controller';
import { LegalRulesAdminController } from '../controllers/legal-rules-admin.controller';
import { RbacAdminController } from '../controllers/rbac-admin.controller';
import { superAdminController } from '../controllers/super-admin.controller';
import { adminLoginLimiter, extractTrustedClientIp } from '../middlewares/security';
import { AuditService } from '../services/AuditService';
import { authOperationsService } from '../services/auth-operations.service';
import { logAuthEvent, normalizeAuthEmail } from '../services/auth.service';
import { AuthRequest } from '../shared/middlewares/auth.middleware';
import {
  requireAuditRead,
  requireDataPlatformAdmin,
  requireLegalAdmin,
  requireLegalPublish,
  requireLegalReview,
  requireRbacAdmin,
} from '../shared/middlewares/data-platform-admin.middleware';
import { getJwtSecret } from '../shared/runtime-config';
import { loginSchema } from '../shared/validations';

export const ADMIN_SESSION_COOKIE_NAME = 'admin_session_jwt';
const DEFAULT_ADMIN_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 horas

/**
 * Resolve e sanitiza o caminho secreto de administração a partir de `process.env.ADMIN_SECRET_PATH`.
 * Impede o uso do caminho estático previsível `/admin`.
 */
export function resolveAdminSecretPath(): string {
  const rawPath = process.env.ADMIN_SECRET_PATH?.trim().replace(/^\/+|\/+$/g, '');

  if (!rawPath || rawPath.toLowerCase() === 'admin') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[IAM_SECURITY_ERROR] ADMIN_SECRET_PATH deve ser definido em produção e não pode ser "admin".',
      );
    }
    return 'internal-ops-vault';
  }

  return rawPath;
}

/**
 * Grava o JWT de sessão administrativa exclusivamente em cookie `HttpOnly` estrito.
 * Nenhum token administrativo é trafegado via `localStorage`.
 */
export function setSecureSessionCookie(
  res: Response,
  token: string,
  maxAgeMs: number = DEFAULT_ADMIN_SESSION_MAX_AGE_MS,
): void {
  const cookieOptions: CookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: maxAgeMs,
  };

  if (process.env.COOKIE_DOMAIN?.trim()) {
    cookieOptions.domain = process.env.COOKIE_DOMAIN.trim();
  }

  res.cookie(ADMIN_SESSION_COOKIE_NAME, token, cookieOptions);
}

/**
 * Remove o cookie `HttpOnly` de sessão administrativa no encerramento da sessão.
 */
export function clearSecureSessionCookie(res: Response): void {
  const cookieOptions: CookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  };

  if (process.env.COOKIE_DOMAIN?.trim()) {
    cookieOptions.domain = process.env.COOKIE_DOMAIN.trim();
  }

  res.clearCookie(ADMIN_SESSION_COOKIE_NAME, cookieOptions);
}

function readCookieFromHeader(req: Request, cookieName: string): string | undefined {
  const rawCookieHeader = req.headers.cookie;
  if (!rawCookieHeader) return undefined;

  for (const part of rawCookieHeader.split(';')) {
    const trimmed = part.trim();
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    if (key === cookieName) {
      return decodeURIComponent(trimmed.slice(separatorIndex + 1).trim());
    }
  }

  return undefined;
}

/**
 * Middleware de proteção de sessão administrativa:
 * Exige que o JWT venha estritamente do cookie `HttpOnly` (`admin_session_jwt`),
 * rejeitando tokens baseados em `localStorage` e validando privilégios administrativos.
 */
export const requireAdminCookieSession: RequestHandler = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const sessionToken = readCookieFromHeader(req, ADMIN_SESSION_COOKIE_NAME);

  if (!sessionToken) {
    return res.status(401).json({
      success: false,
      code: 'ADMIN_COOKIE_SESSION_REQUIRED',
      message: 'Sessão administrativa ausente. Autentique-se via cookie HttpOnly seguro.',
    });
  }

  try {
    const decoded = jwt.verify(sessionToken, getJwtSecret()) as Record<string, any>;

    if (decoded.token_type && decoded.token_type !== 'access') {
      return res.status(401).json({
        success: false,
        code: 'INVALID_ADMIN_TOKEN_TYPE',
        message: 'Tipo de token inválido para sessão administrativa.',
      });
    }

    const rawRole = typeof decoded.role === 'string' ? decoded.role.toLowerCase() : '';
    const permissions = Array.isArray(decoded.permissions)
      ? decoded.permissions.filter((p: unknown): p is string => typeof p === 'string')
      : [];

    const isAdminUser =
      decoded.is_admin === true ||
      decoded.admin === true ||
      rawRole === 'admin' ||
      rawRole === 'super_admin' ||
      permissions.some((p) => p.startsWith('admin:') || p.startsWith('data_platform:') || p.startsWith('rbac:'));

    if (!isAdminUser) {
      return res.status(403).json({
        success: false,
        code: 'ADMIN_PRIVILEGE_REQUIRED',
        message: 'Acesso negado: privilégios administrativos insuficientes.',
      });
    }

    req.user = {
      id: String(decoded.id),
      tenantId: String(decoded.tenant_id),
      email: normalizeAuthEmail(String(decoded.email || '')),
      nome: decoded.nome ?? null,
      telefone: decoded.telefone ?? null,
      plano: String(decoded.plano || 'master'),
      role: rawRole === 'super_admin' ? 'super_admin' : 'admin',
      isAdmin: true,
      permissions,
      companyId: typeof decoded.company_id === 'string' ? decoded.company_id : null,
    };

    return next();
  } catch {
    clearSecureSessionCookie(res);
    return res.status(401).json({
      success: false,
      code: 'ADMIN_SESSION_EXPIRED',
      message: 'Sessão administrativa inválida ou expirada.',
    });
  }
};

const handle =
  (handler: RequestHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

const auditAdmin = new AuditAdminController();
const dataPlatformAdmin = new DataPlatformAdminController();
const legalRulesAdmin = new LegalRulesAdminController();
const rbacAdmin = new RbacAdminController();

/**
 * Handler de login administrativo protegido por `adminLoginLimiter`.
 * Emite exclusivamente o cookie `HttpOnly` `admin_session_jwt` (sem expor tokens para `localStorage`).
 */
const adminLoginHandler: RequestHandler = async (req: Request, res: Response) => {
  const ipAddress = extractTrustedClientIp(req);
  const userAgent = String(req.headers['user-agent'] || '');

  try {
    const { email, senha } = loginSchema.parse(req.body);
    const auditContext = {
      requestId: req.headers['x-request-id'] || req.headers['x-correlation-id'],
      ip: ipAddress,
      userAgent,
    };

    const { publicUser, tokens } = await authOperationsService.loginUser(email, senha, auditContext);
    const adminUserCandidate = publicUser as Record<string, any>;
    const candidateRole = String(adminUserCandidate.role || '').toLowerCase();
    const candidatePerms = Array.isArray(adminUserCandidate.permissions)
      ? adminUserCandidate.permissions
      : Array.isArray(adminUserCandidate.permissoes)
        ? adminUserCandidate.permissoes
        : [];

    const isAuthorizedAdmin =
      adminUserCandidate.isAdmin === true ||
      adminUserCandidate.is_admin === true ||
      candidateRole === 'admin' ||
      candidateRole === 'super_admin' ||
      candidatePerms.length > 0;

    if (!isAuthorizedAdmin) {
      AuditService.logAction('LOGIN_FAILED', ipAddress, userAgent, publicUser.id, {
        email: publicUser.email,
        role: publicUser.role,
        reason: 'insufficient_admin_privileges',
      });

      return res.status(403).json({
        success: false,
        code: 'ADMIN_ACCESS_DENIED',
        message: 'Esta conta não possui credenciais administrativas.',
      });
    }

    setSecureSessionCookie(res, tokens.accessToken);

    AuditService.logAction('LOGIN_SUCCESS', ipAddress, userAgent, publicUser.id, {
      email: publicUser.email,
      role: candidateRole || publicUser.role,
    });

    return res.status(200).json({
      success: true,
      data: {
        user: publicUser,
        sessionTransport: 'httpOnly_cookie',
      },
    });
  } catch (err: any) {
    const attemptedEmail =
      typeof req.body?.email === 'string' ? normalizeAuthEmail(req.body.email) : null;

    if (err?.name === 'ZodError') {
      AuditService.logAction('LOGIN_FAILED', ipAddress, userAgent, null, {
        email: attemptedEmail,
        reason: 'validation_error',
      });

      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Credenciais em formato inválido.',
      });
    }

    AuditService.logAction('LOGIN_FAILED', ipAddress, userAgent, null, {
      email: attemptedEmail,
      reason: 'invalid_credentials',
    });

    await logAuthEvent('LOGIN_FAILED', {
      email: attemptedEmail,
      reason: 'admin_login_failed',
      ip: ipAddress,
      userAgent,
    }).catch(() => null);

    return res.status(401).json({
      success: false,
      code: 'INVALID_CREDENTIALS',
      message: 'Credenciais administrativas inválidas.',
    });
  }
};

const adminLogoutHandler: RequestHandler = async (req: AuthRequest, res: Response) => {
  clearSecureSessionCookie(res);
  return res.status(200).json({
    success: true,
    message: 'Sessão administrativa encerrada com segurança.',
  });
};

/**
 * Constrói um sub-roteador administrativo com todas as rotas de gestão protegidas.
 * O `adminLoginLimiter` é aplicado EXCLUSIVAMENTE na rota `POST /login`.
 */
function createProtectedAdminSubRouter(): Router {
  const subRouter = Router();

  // Isolamento estrito: adminLoginLimiter aplicado exclusivamente no POST /login
  subRouter.post('/login', adminLoginLimiter, handle(adminLoginHandler));
  subRouter.post('/logout', requireAdminCookieSession, handle(adminLogoutHandler));
  subRouter.get('/radar/telemetry', requireAdminCookieSession, handle(AuditController.getTelemetry));

  // Todas as rotas abaixo exigem sessão via cookie HttpOnly estrito
  subRouter.use(requireAdminCookieSession);

  // Auditoria
  subRouter.get('/audit/events', requireAuditRead as RequestHandler, handle(auditAdmin.listEvents.bind(auditAdmin) as RequestHandler));
  subRouter.get('/audit/metrics', requireAuditRead as RequestHandler, handle(auditAdmin.metrics.bind(auditAdmin) as RequestHandler));

  // Super Admin
  subRouter.get('/super/metrics', requireRbacAdmin as RequestHandler, handle(superAdminController.getMetrics.bind(superAdminController) as RequestHandler));
  subRouter.get('/super/users', requireRbacAdmin as RequestHandler, handle(superAdminController.listUsers.bind(superAdminController) as RequestHandler));
  subRouter.post('/super/email', requireRbacAdmin as RequestHandler, handle(superAdminController.sendEmail.bind(superAdminController) as RequestHandler));

  // Data Platform Admin
  subRouter.get('/data-platform/jobs', requireDataPlatformAdmin as RequestHandler, handle(dataPlatformAdmin.listJobs.bind(dataPlatformAdmin) as RequestHandler));
  subRouter.get('/data-platform/events', requireDataPlatformAdmin as RequestHandler, handle(dataPlatformAdmin.listEvents.bind(dataPlatformAdmin) as RequestHandler));
  subRouter.get('/data-platform/tasks', requireDataPlatformAdmin as RequestHandler, handle(dataPlatformAdmin.listTasks.bind(dataPlatformAdmin) as RequestHandler));
  subRouter.get('/data-platform/cursors', requireDataPlatformAdmin as RequestHandler, handle(dataPlatformAdmin.listCursors.bind(dataPlatformAdmin) as RequestHandler));
  subRouter.get('/data-platform/metrics', requireDataPlatformAdmin as RequestHandler, handle(dataPlatformAdmin.metrics.bind(dataPlatformAdmin) as RequestHandler));
  subRouter.post('/data-platform/ingest/pncp', requireDataPlatformAdmin as RequestHandler, handle(dataPlatformAdmin.runPncpIngestion.bind(dataPlatformAdmin) as RequestHandler));
  subRouter.post('/data-platform/ingest/comprasgov', requireDataPlatformAdmin as RequestHandler, handle(dataPlatformAdmin.runComprasGovIngestion.bind(dataPlatformAdmin) as RequestHandler));
  subRouter.post('/data-platform/ingest/tcu', requireDataPlatformAdmin as RequestHandler, handle(dataPlatformAdmin.runTcuIngestion.bind(dataPlatformAdmin) as RequestHandler));
  subRouter.post('/data-platform/index/consume', requireDataPlatformAdmin as RequestHandler, handle(dataPlatformAdmin.consumeIndexTasks.bind(dataPlatformAdmin) as RequestHandler));
  subRouter.post('/data-platform/requeue/skipped', requireDataPlatformAdmin as RequestHandler, handle(dataPlatformAdmin.requeueSkipped.bind(dataPlatformAdmin) as RequestHandler));
  subRouter.post('/data-platform/requeue/failed', requireDataPlatformAdmin as RequestHandler, handle(dataPlatformAdmin.requeueFailed.bind(dataPlatformAdmin) as RequestHandler));
  subRouter.post('/data-platform/tasks/cleanup', requireDataPlatformAdmin as RequestHandler, handle(dataPlatformAdmin.cleanupOldTasks.bind(dataPlatformAdmin) as RequestHandler));

  // RBAC Admin
  subRouter.get('/rbac/roles', requireRbacAdmin as RequestHandler, handle(rbacAdmin.listRoles.bind(rbacAdmin) as RequestHandler));
  subRouter.post('/rbac/roles', requireRbacAdmin as RequestHandler, handle(rbacAdmin.createRole.bind(rbacAdmin) as RequestHandler));
  subRouter.get('/rbac/permissions', requireRbacAdmin as RequestHandler, handle(rbacAdmin.listPermissions.bind(rbacAdmin) as RequestHandler));
  subRouter.get('/rbac/users/:userId/permissions', requireRbacAdmin as RequestHandler, handle(rbacAdmin.listUserPermissions.bind(rbacAdmin) as RequestHandler));
  subRouter.post('/rbac/user-roles', requireRbacAdmin as RequestHandler, handle(rbacAdmin.assignRole.bind(rbacAdmin) as RequestHandler));
  subRouter.delete('/rbac/user-roles', requireRbacAdmin as RequestHandler, handle(rbacAdmin.revokeRole.bind(rbacAdmin) as RequestHandler));
  subRouter.post('/rbac/user-roles/revoke', requireRbacAdmin as RequestHandler, handle(rbacAdmin.revokeRole.bind(rbacAdmin) as RequestHandler));

  // Legal Rules Admin
  subRouter.get('/legal-rules', requireLegalAdmin as RequestHandler, handle(legalRulesAdmin.listRules.bind(legalRulesAdmin) as RequestHandler));
  subRouter.get('/legal-rules/:id', requireLegalAdmin as RequestHandler, handle(legalRulesAdmin.getRule.bind(legalRulesAdmin) as RequestHandler));
  subRouter.post('/legal-rules', requireLegalAdmin as RequestHandler, handle(legalRulesAdmin.createRule.bind(legalRulesAdmin) as RequestHandler));
  subRouter.patch('/legal-rules/:id', requireLegalAdmin as RequestHandler, handle(legalRulesAdmin.updateRule.bind(legalRulesAdmin) as RequestHandler));
  subRouter.post('/legal-rules/:id/submit-review', requireLegalAdmin as RequestHandler, handle(legalRulesAdmin.submitReview.bind(legalRulesAdmin) as RequestHandler));
  subRouter.post('/legal-rules/:id/approve', requireLegalReview as RequestHandler, handle(legalRulesAdmin.approveRule.bind(legalRulesAdmin) as RequestHandler));
  subRouter.post('/legal-rules/:id/reject', requireLegalReview as RequestHandler, handle(legalRulesAdmin.rejectRule.bind(legalRulesAdmin) as RequestHandler));
  subRouter.post('/legal-rules/:id/activate-approved', requireLegalPublish as RequestHandler, handle(legalRulesAdmin.activateApproved.bind(legalRulesAdmin) as RequestHandler));
  subRouter.get('/legal-rules/:id/history', requireLegalAdmin as RequestHandler, handle(legalRulesAdmin.history.bind(legalRulesAdmin) as RequestHandler));
  subRouter.get('/legal-rules/:id/diff/:compareId', requireLegalAdmin as RequestHandler, handle(legalRulesAdmin.diff.bind(legalRulesAdmin) as RequestHandler));
  subRouter.post('/legal-rules/:id/activate', requireLegalPublish as RequestHandler, handle(legalRulesAdmin.activateRule.bind(legalRulesAdmin) as RequestHandler));
  subRouter.post('/legal-rules/:id/deactivate', requireLegalAdmin as RequestHandler, handle(legalRulesAdmin.deactivateRule.bind(legalRulesAdmin) as RequestHandler));
  subRouter.post('/legal-rules/:id/new-version', requireLegalAdmin as RequestHandler, handle(legalRulesAdmin.createNewVersion.bind(legalRulesAdmin) as RequestHandler));

  return subRouter;
}

const adminRouter = Router();
const adminSecretPath = resolveAdminSecretPath().trim();
const protectedAdminSubRouter = createProtectedAdminSubRouter();

// Ofuscação da Rota Admin via process.env.ADMIN_SECRET_PATH:
// Ex: /backend/${ADMIN_SECRET_PATH}/login
adminRouter.use(`/backend/${adminSecretPath}`, protectedAdminSubRouter);
adminRouter.use(`/${adminSecretPath}`, protectedAdminSubRouter);

export default adminRouter;
