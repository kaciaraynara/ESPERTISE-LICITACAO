import { Router, RequestHandler } from 'express';
import { PrazosController } from '../controllers/prazos.controller';
import { requireRole } from '../shared/middlewares/role.middleware';

const router = Router();
const controller = new PrazosController();

const handle = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const fornecedorOuContador = requireRole('fornecedor') as RequestHandler;

router.get('/', fornecedorOuContador, handle(controller.listar.bind(controller) as RequestHandler));
router.patch('/:id/concluir', fornecedorOuContador, handle(controller.concluir.bind(controller) as RequestHandler));

export default router;
