import { Router, RequestHandler } from 'express';
import { certidoesController } from '../controllers/certidoes.controller';
import { authMiddleware } from '../shared/middlewares/auth.middleware';
import { requireRole } from '../shared/middlewares/role.middleware';

const router = Router();

const handle = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const fornecedorOuContador = requireRole('fornecedor') as RequestHandler;

router.use(authMiddleware as RequestHandler);
router.use(fornecedorOuContador);

router.post('/force-sync', handle(certidoesController.forceSync.bind(certidoesController) as RequestHandler));
router.get('/', handle(certidoesController.listar.bind(certidoesController) as RequestHandler));
router.get('/:id/download', handle(certidoesController.download.bind(certidoesController) as RequestHandler));
router.get('/:id', handle(certidoesController.download.bind(certidoesController) as RequestHandler));

export default router;
