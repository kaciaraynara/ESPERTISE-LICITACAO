import { Router, RequestHandler } from 'express';
import { ContratosController } from '../controllers/contratos.controller';
import { requireRole } from '../shared/middlewares/role.middleware';
import { requirePlanFeatureAccess } from '../shared/middlewares/plan-limits.middleware';

const router = Router();
const controller = new ContratosController();

const handle =
  (handler: RequestHandler): RequestHandler =>
    (req, res, next) => {
      Promise.resolve(handler(req, res, next)).catch(next);
    };

const fornecedor = requireRole('fornecedor') as RequestHandler;

// Gestão Contratual e alertas de vencimento fazem parte do Plano Básico.
const requireGestaoContratual = requirePlanFeatureAccess('gestao_contratual') as RequestHandler;

// O motor de reajuste por índices oficiais é exclusivo do Plano Master.
const requireReajusteMaster = requirePlanFeatureAccess('robo_reajuste') as RequestHandler;
const requireGestaoGarantias = requirePlanFeatureAccess('gestao_garantias') as RequestHandler;

router.get(
  '/garantias',
  fornecedor,
  requireGestaoContratual,
  requireGestaoGarantias,
  handle(controller.listarGarantias.bind(controller) as RequestHandler),
);

router.get(
  '/garantias/:id/restituicao',
  fornecedor,
  requireGestaoContratual,
  requireGestaoGarantias,
  handle(controller.gerarOficioRestituicaoGarantia.bind(controller) as RequestHandler),
);

router.get(
  '/',
  fornecedor,
  requireGestaoContratual,
  handle(controller.listar.bind(controller) as RequestHandler),
);

router.post(
  '/',
  fornecedor,
  requireGestaoContratual,
  handle(controller.criar.bind(controller) as RequestHandler),
);

router.patch(
  '/:id',
  fornecedor,
  requireGestaoContratual,
  handle(controller.atualizar.bind(controller) as RequestHandler),
);

router.post(
  '/:id/reajuste',
  fornecedor,
  requireReajusteMaster,
  handle(controller.gerarRelatorioReajuste.bind(controller) as RequestHandler),
);

router.post(
  '/:id/repactuacao/oficio',
  fornecedor,
  requireReajusteMaster,
  handle(controller.gerarOficioRepactuacao.bind(controller) as RequestHandler),
);

export default router;
