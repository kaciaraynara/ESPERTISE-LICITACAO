import { Router, RequestHandler } from 'express';
import { MercadoPagoController } from '../controllers/mercadopago.controller';
import { authMiddleware } from '../shared/middlewares/auth.middleware';

const router = Router();
const controller = new MercadoPagoController();

const handle =
  (handler: RequestHandler): RequestHandler =>
    (req, res, next) => {
      Promise.resolve(handler(req, res, next)).catch(next);
    };

router.get(
  '/planos',
  handle(controller.listPlanos.bind(controller) as RequestHandler),
);

router.post(
  '/checkout',
  authMiddleware as RequestHandler,
  handle(controller.criarCheckout.bind(controller) as RequestHandler),
);

router.get(
  '/assinatura',
  authMiddleware as RequestHandler,
  handle(controller.minhaAssinatura.bind(controller) as RequestHandler),
);

router.post(
  '/assinatura/reconciliar',
  authMiddleware as RequestHandler,
  handle(controller.reconciliarAssinatura.bind(controller) as RequestHandler),
);

router.post(
  '/trial/ativar',
  authMiddleware as RequestHandler,
  handle(controller.ativarTrial.bind(controller) as RequestHandler),
);

export default router;
