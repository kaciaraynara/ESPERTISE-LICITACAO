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
  '/descoberta',
  fornecedor,
  handle(controller.descoberta.bind(controller) as unknown as RequestHandler),
);

router.get(
  '/mercado',
  fornecedor,
  planCompetitorHistoryFeature,
  handle(controller.mercado.bind(controller) as unknown as RequestHandler),
);

router.get(
  '/:cnpj/dossie',
  fornecedor,
    handle(controller.dossie.bind(controller) as RequestHandler),
);

router.post(
  '/integridade',
  fornecedor,
  handle(controller.integridade.bind(controller) as unknown as RequestHandler),
);

router.post(
  '/extrair-ata',
  fornecedor,
  handle(controller.extrairAta.bind(controller) as unknown as RequestHandler),
);

router.post(
  '/historico',
  fornecedor,
  handle(controller.historico.bind(controller) as unknown as RequestHandler),
);

export default router;
