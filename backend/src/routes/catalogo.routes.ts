import { Router, RequestHandler } from 'express';
import { CatalogoController } from '../controllers/catalogo.controller';
import { requireRole } from '../shared/middlewares/role.middleware';

const router = Router();
const controller = new CatalogoController();

const handle = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const fornecedorOuContador = requireRole('fornecedor') as RequestHandler;

router.get('/', fornecedorOuContador, handle(controller.listar.bind(controller) as RequestHandler));
router.post('/', fornecedorOuContador, handle(controller.criar.bind(controller) as RequestHandler));
router.patch('/:id', fornecedorOuContador, handle(controller.atualizar.bind(controller) as RequestHandler));
router.delete('/:id', fornecedorOuContador, handle(controller.remover.bind(controller) as RequestHandler));

export default router;
