import { rateLimit } from 'express-rate-limit';
import { AuthRequest } from './auth.middleware';

export const lexAIRateLimit = rateLimit({
  windowMs: Number(process.env.LEX_AI_RATE_LIMIT_WINDOW_MS) || 60 * 1000,
  max: Number(process.env.LEX_AI_RATE_LIMIT_MAX) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = (req as AuthRequest).user?.id;
    return userId ? `lex-user:${userId}` : `lex-ip:${req.ip || 'unknown'}`;
  },
  message: {
    success: false,
    message: 'Você atingiu o limite de consultas do assistente. Tente novamente em alguns instantes.',
  },
});
