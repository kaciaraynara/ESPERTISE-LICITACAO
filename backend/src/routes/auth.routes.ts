import { Router, RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../shared/middlewares/auth.middleware';
import { extractTrustedClientIp } from '../middlewares/security';

const router = Router();
const controller = new AuthController();

function buildAuthRouteRateLimit(max: number, code: string, message: string, windowMs = 15 * 60 * 1000) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => extractTrustedClientIp(req),
    skip: () => process.env.NODE_ENV === 'test' && process.env.ENABLE_AUTH_RATE_LIMIT_IN_TEST !== 'true',
    message: {
      success: false,
      code,
      message,
    },
  });
}

const authRateLimit = buildAuthRouteRateLimit(
  Number(process.env.AUTH_RATE_LIMIT_MAX) || 30,
  'AUTH_RATE_LIMIT_EXCEEDED',
  'Muitas tentativas de autenticação. Tente novamente mais tarde.',
  Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
);

const registerRateLimit = buildAuthRouteRateLimit(
  Number(process.env.AUTH_REGISTER_RATE_LIMIT_MAX) || 20,
  'AUTH_REGISTER_RATE_LIMIT_EXCEEDED',
  'Muitas tentativas de cadastro a partir deste IP. Tente novamente em alguns minutos.',
);

const passwordResetRateLimit = buildAuthRouteRateLimit(
  Number(process.env.AUTH_RESET_RATE_LIMIT_MAX) || 10,
  'AUTH_RESET_RATE_LIMIT_EXCEEDED',
  'Muitas solicitações de recuperação de senha. Aguarde antes de tentar novamente.',
);

const handle = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

// Rate limit estritamente isolado em endpoints públicos sensíveis (/register, /login, recuperação/reset)
// Rotas internas, sessões, /me e /refresh não possuem rate limit global.
router.post('/register', registerRateLimit, handle(controller.register.bind(controller) as RequestHandler));
router.post('/login', authRateLimit, handle(controller.login.bind(controller) as RequestHandler));
router.post('/refresh', handle(controller.refresh.bind(controller) as RequestHandler));
router.post('/logout', handle(controller.logout.bind(controller) as RequestHandler));
router.post('/forgot-password', passwordResetRateLimit, handle(controller.forgotPassword.bind(controller) as RequestHandler));
router.post('/esqueci-senha', passwordResetRateLimit, handle(controller.forgotPassword.bind(controller) as RequestHandler));
router.post('/reset-password', passwordResetRateLimit, handle(controller.resetPassword.bind(controller) as RequestHandler));
router.post('/redefinir-senha', passwordResetRateLimit, handle(controller.resetPassword.bind(controller) as RequestHandler));
router.get('/me', authMiddleware as RequestHandler, handle(controller.me.bind(controller) as RequestHandler));
router.put('/update-profile', authMiddleware as RequestHandler, handle(controller.updateProfile.bind(controller) as RequestHandler));
router.get('/export-data', authMiddleware as RequestHandler, handle(controller.exportData.bind(controller) as RequestHandler));
router.delete('/account', authMiddleware as RequestHandler, handle(controller.deleteAccount.bind(controller) as RequestHandler));

export default router;
