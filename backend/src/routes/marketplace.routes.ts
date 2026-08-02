import { Router, RequestHandler } from 'express';
import { FornecedorMarketplaceController } from '../controllers/fornecedor-marketplace.controller';
import { requireRole } from '../shared/middlewares/role.middleware';

const router = Router();
const controller = new FornecedorMarketplaceController();
const fornecedor = requireRole('fornecedor') as RequestHandler;

const handle = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

router.get('/fornecedores', fornecedor, handle(controller.listar.bind(controller) as RequestHandler));
router.post('/fornecedores', fornecedor, handle(controller.criar.bind(controller) as RequestHandler));
router.get('/fornecedores/:id', fornecedor, handle(controller.buscarPorId.bind(controller) as RequestHandler));
router.patch('/fornecedores/:id', fornecedor, handle(controller.atualizar.bind(controller) as RequestHandler));
router.delete('/fornecedores/:id', fornecedor, handle(controller.remover.bind(controller) as RequestHandler));

export default router;
