import { rateLimit } from 'express-rate-limit';

export const lexAIRateLimit = rateLimit({
  windowMs: Number(process.env.LEX_AI_RATE_LIMIT_WINDOW_MS) || 60 * 1000,
  max: Number(process.env.LEX_AI_RATE_LIMIT_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Limite de consultas do LEX IA atingido. Aguarde um instante para preservar a operação.',
  },
});