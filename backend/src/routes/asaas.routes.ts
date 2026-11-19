import { Router, RequestHandler } from 'express';
import { AsaasController } from '../controllers/asaas.controller';
import { companyContextMiddleware } from '../shared/middlewares/auth.middleware';

const router = Router();
const controller = new AsaasController();

const handle = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

router.get('/planos', handle(controller.listPlanos.bind(controller)));
router.get('/assinatura', companyContextMiddleware as RequestHandler, handle(controller.minhaAssinatura.bind(controller)));
router.post('/trial/ativar', companyContextMiddleware as RequestHandler, handle(controller.ativarTrial.bind(controller)));
router.post('/assinatura/reconciliar', companyContextMiddleware as RequestHandler, handle(controller.reconciliarAssinatura.bind(controller)));
router.post('/checkout', companyContextMiddleware as RequestHandler, handle(controller.criarCheckout.bind(controller)));

export default router;
