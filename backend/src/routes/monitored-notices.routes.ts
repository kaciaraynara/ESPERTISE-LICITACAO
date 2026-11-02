import { Router, RequestHandler } from 'express';
import { MonitoredNoticesController } from '../controllers/monitored-notices.controller';
import { authMiddleware } from '../shared/middlewares/auth.middleware';
import { requireRole } from '../shared/middlewares/role.middleware';

const router = Router();
const controller = new MonitoredNoticesController();

const handle = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

router.use(authMiddleware as RequestHandler);
router.use(requireRole('fornecedor') as RequestHandler);

// Lista editais monitorados da empresa do usuário autenticado
router.get('/', handle(controller.listar.bind(controller) as RequestHandler));

// Remove edital da watchlist
router.delete('/:id', handle(controller.remover.bind(controller) as RequestHandler));

// Atualiza prioridade ou notas de um edital monitorado
router.patch('/:id/prioridade', handle(controller.atualizarPrioridade.bind(controller) as RequestHandler));

export default router;
