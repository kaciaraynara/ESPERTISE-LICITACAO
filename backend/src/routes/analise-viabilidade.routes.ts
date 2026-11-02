import { Router, RequestHandler } from 'express';
import { AnaliseViabilidadeController } from '../controllers/analise-viabilidade.controller';
import { authMiddleware, AuthRequest } from '../shared/middlewares/auth.middleware';
import { requirePlanLimit, incrementPlanUsage } from '../shared/middlewares/plan-limits.middleware';

const router = Router();
const controller = new AnaliseViabilidadeController();

router.use(authMiddleware as RequestHandler);

// GET /api/v1/analise-viabilidade e /api/v1/analise-viabilidade/:editalId
router.get('/', requirePlanLimit('analyses') as RequestHandler, async (req, res) => {
  const result = await controller.getAnalisePorEdital(req, res);
  if (res.statusCode >= 200 && res.statusCode < 400 && (req as AuthRequest).user?.id) {
    void incrementPlanUsage((req as AuthRequest).user!.id, 'analyses');
  }
  return result;
});

router.get('/:editalId', requirePlanLimit('analyses') as RequestHandler, async (req, res) => {
  const result = await controller.getAnalisePorEdital(req, res);
  if (res.statusCode >= 200 && res.statusCode < 400 && (req as AuthRequest).user?.id) {
    void incrementPlanUsage((req as AuthRequest).user!.id, 'analyses');
  }
  return result;
});

export default router;
