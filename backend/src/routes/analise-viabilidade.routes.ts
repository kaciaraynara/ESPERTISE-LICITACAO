import { Router, RequestHandler } from 'express';
import { AnaliseViabilidadeController } from '../controllers/analise-viabilidade.controller';
import { authMiddleware } from '../shared/middlewares/auth.middleware';

const router = Router();
const controller = new AnaliseViabilidadeController();

router.use(authMiddleware as RequestHandler);

// GET /api/v1/analise-viabilidade e /api/v1/analise-viabilidade/:editalId
// Leitura e visualização do score e viabilidade de editais oficiais
router.get('/', (async (req, res) => {
  return controller.getAnalisePorEdital(req, res);
}) as RequestHandler);

router.get('/:editalId', (async (req, res) => {
  return controller.getAnalisePorEdital(req, res);
}) as RequestHandler);

export default router;
