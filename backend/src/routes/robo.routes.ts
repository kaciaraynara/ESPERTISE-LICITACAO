import { Router, RequestHandler } from 'express';
import { RoboController } from '../controllers/robo.controller';

const router = Router();
const controller = new RoboController();

const handle = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

import { requireRole } from '../shared/middlewares/role.middleware';
import { requirePlanFeature } from '../shared/middlewares/plan-feature.middleware';

const fornecedor = requireRole('fornecedor') as RequestHandler;
const planRobot = requirePlanFeature('bid.robot');
const middlewares = [fornecedor, planRobot];

router.get('/:licitacaoId/config', ...middlewares, handle(controller.getConfig.bind(controller) as RequestHandler));
router.post('/:licitacaoId/config', ...middlewares, handle(controller.salvarConfig.bind(controller) as RequestHandler));
router.post('/:licitacaoId/lance', ...middlewares, handle(controller.processarLance.bind(controller) as RequestHandler));
router.get('/:licitacaoId/logs', ...middlewares, handle(controller.getLogs.bind(controller) as RequestHandler));
router.patch('/:licitacaoId/toggle', ...middlewares, handle(controller.toggleRobo.bind(controller) as RequestHandler));

export default router;
