import { Router, RequestHandler } from 'express';
import { EmpresasController } from '../controllers/empresas.controller';
import { requireRole } from '../shared/middlewares/role.middleware';
import { requirePlanLimit } from '../shared/middlewares/plan-limits.middleware';

const router = Router();
const controller = new EmpresasController();

const handle = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const fornecedorOuContador = requireRole('fornecedor') as RequestHandler;

router.get('/', fornecedorOuContador, handle(controller.listar.bind(controller) as RequestHandler));
router.post('/', fornecedorOuContador, requirePlanLimit('cnpjs'), handle(controller.criar.bind(controller) as RequestHandler));
router.get('/:id', fornecedorOuContador, handle(controller.buscarPorId.bind(controller) as RequestHandler));
router.patch('/:id', fornecedorOuContador, handle(controller.atualizar.bind(controller) as RequestHandler));

export default router;
