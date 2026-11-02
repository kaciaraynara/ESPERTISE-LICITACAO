import { Router, RequestHandler } from 'express';
import { ConcorrentesController } from '../controllers/concorrentes.controller';
import { requireRole } from '../shared/middlewares/role.middleware';
import { requirePlanFeature } from '../shared/middlewares/plan-feature.middleware';
import { requireMasterPlan } from '../shared/middlewares/plan-limits.middleware';

const router = Router();
const controller = new ConcorrentesController();

const handle = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const fornecedor = requireRole('fornecedor') as RequestHandler;
const planMalhaFinaFeature = requirePlanFeature('malha_fina_qsa') as RequestHandler;
const planCompetitorHistoryFeature = requirePlanFeature('historico_concorrentes') as RequestHandler;

router.post(
  '/malha-fina',
  fornecedor,
  planMalhaFinaFeature,
  requireMasterPlan,
  handle(controller.malhaFina.bind(controller) as RequestHandler),
);

router.get(
  '/:cnpj/dossie',
  fornecedor,
  planCompetitorHistoryFeature,
  handle(controller.dossie.bind(controller) as RequestHandler),
);

export default router;
