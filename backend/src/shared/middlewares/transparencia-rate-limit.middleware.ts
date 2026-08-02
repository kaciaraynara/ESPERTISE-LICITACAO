import { rateLimit } from 'express-rate-limit';
import type { AuthRequest } from './auth.middleware';

/**
 * Rate limiter específico para rotas do Portal da Transparência.
 * Limita cada usuário (por IP) a 30 consultas por minuto,
 * protegendo tanto o token quanto o backend.
 */
export const transparenciaRateLimit = rateLimit({
  windowMs: 60_000, // 1 minuto
  max: 30,          // 30 req/min por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Muitas consultas ao Portal da Transparência. Aguarde 1 minuto antes de tentar novamente.',
  },
  keyGenerator: (req) => {
    const userId = (req as AuthRequest).user?.id;
    return userId || req.ip || 'unknown';
  },
});
