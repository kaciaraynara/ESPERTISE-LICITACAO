import { Router, RequestHandler } from 'express';
import { LexController } from '../controllers/lex.controller';

const router = Router();
const controller = new LexController();

const handle = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

// Assuming you have this middleware
import { requirePlanFeature } from '../shared/middlewares/plan-feature.middleware';

router.post('/chat', handle(controller.chat.bind(controller) as RequestHandler));
router.post('/auditar', handle(controller.auditar.bind(controller) as RequestHandler));
router.post('/resumo', handle(controller.resumo.bind(controller) as RequestHandler));
router.post('/proposta', handle(controller.proposta.bind(controller) as RequestHandler));
router.post('/impugnacao', requirePlanFeature('impugnation.simple'), handle(controller.impugnacao.bind(controller) as RequestHandler));
router.post('/recurso', requirePlanFeature('impugnation.simple'), handle(controller.gerarRecurso.bind(controller) as RequestHandler));

export default router;
