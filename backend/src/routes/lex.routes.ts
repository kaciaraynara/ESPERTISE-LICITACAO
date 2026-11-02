import { Router, RequestHandler } from 'express';
import { LexController } from '../controllers/lex.controller';
import { authMiddleware } from '../shared/middlewares/auth.middleware';
import { lexAIRateLimit } from '../shared/middlewares/lex-ai-rate-limit.middleware';
import { requirePlanFeature } from '../shared/middlewares/plan-feature.middleware';
import { requirePlanLimit } from '../shared/middlewares/plan-limits.middleware';

const router = Router();
const controller = new LexController();

const handle = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

// Todas as rotas do LEX exigem autenticação obrigatória
router.use(authMiddleware as RequestHandler);

// Rate limit para proteção contra abusos e custos de IA
router.use(lexAIRateLimit);

router.post('/chat', handle(controller.chat.bind(controller) as RequestHandler));
router.post('/auditar', requirePlanLimit('analyses'), handle(controller.auditar.bind(controller) as RequestHandler));
router.post('/resumo', handle(controller.resumo.bind(controller) as RequestHandler));
router.post('/proposta', requirePlanLimit('proposals'), handle(controller.proposta.bind(controller) as RequestHandler));
router.post('/extrair-proposta', requirePlanLimit('proposals'), handle(controller.extrairParaProposta.bind(controller) as RequestHandler));
router.post('/preencher-proposta', requirePlanLimit('proposals'), handle(controller.preencherProposta.bind(controller) as RequestHandler));
router.post('/analise', requirePlanLimit('analyses'), handle(controller.analise.bind(controller) as RequestHandler));
router.post('/impugnacao', requirePlanFeature('impugnation.simple'), handle(controller.impugnacao.bind(controller) as RequestHandler));
router.post('/recurso', requirePlanFeature('impugnation.simple'), handle(controller.gerarRecurso.bind(controller) as RequestHandler));
router.post('/parecer-pdf', handle(controller.exportarParecerPdf.bind(controller) as RequestHandler));

export default router;
