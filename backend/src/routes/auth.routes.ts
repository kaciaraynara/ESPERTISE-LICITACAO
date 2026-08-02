import { Router, RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../shared/middlewares/auth.middleware';
import { PostgresRateLimitStore } from '../shared/middlewares/postgres-rate-limit.store';

const router = Router();
const controller = new AuthController();
const authRateLimit = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: new PostgresRateLimitStore('auth-ip'),
  passOnStoreError: false,
  message: {
    success: false,
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
    message: 'Muitas tentativas de autenticação. Tente novamente mais tarde.',
  },
});

const handle = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

router.use(authRateLimit);
router.post('/register', handle(controller.register.bind(controller) as RequestHandler));
router.post('/login', handle(controller.login.bind(controller) as RequestHandler));
router.post('/refresh', handle(controller.refresh.bind(controller) as RequestHandler));
router.post('/logout', handle(controller.logout.bind(controller) as RequestHandler));
router.post('/forgot-password', handle(controller.forgotPassword.bind(controller) as RequestHandler));
router.post('/reset-password', handle(controller.resetPassword.bind(controller) as RequestHandler));
router.get('/me', authMiddleware as RequestHandler, handle(controller.me.bind(controller) as RequestHandler));
router.put('/update-profile', authMiddleware as RequestHandler, handle(controller.updateProfile.bind(controller) as RequestHandler));

export default router;
