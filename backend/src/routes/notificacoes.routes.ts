import { Router, RequestHandler } from 'express';
import { NotificacoesController } from '../controllers/notificacoes.controller';
import { requireRole } from '../shared/middlewares/role.middleware';

const router = Router();
const controller = new NotificacoesController();

const handle = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const autenticado = requireRole('fornecedor') as RequestHandler; // It seems requireRole takes one arg that must be a string role

router.get('/', autenticado, handle(controller.listar.bind(controller) as RequestHandler));
router.post('/marcar-todas-lidas', autenticado, handle(controller.marcarTodasComoLidas.bind(controller) as RequestHandler));
router.post('/teste-sms', autenticado, handle(controller.enviarSmsTeste.bind(controller) as RequestHandler));

export default router;
