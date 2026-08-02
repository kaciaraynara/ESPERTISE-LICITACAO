import { Router, RequestHandler } from 'express';
import { AIController } from '../controllers/ai.controller';
import { authMiddleware } from '../shared/middlewares/auth.middleware';
import { lexAIRateLimit } from '../shared/middlewares/lex-ai-rate-limit.middleware';

const router = Router();
const ai = new AIController();

const handle = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

router.post(
  '/consultar',
  authMiddleware as RequestHandler,
  lexAIRateLimit,
  handle(ai.consultar.bind(ai) as RequestHandler),
);

export default router;