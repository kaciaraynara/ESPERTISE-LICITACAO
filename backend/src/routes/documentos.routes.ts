import { Router, RequestHandler } from 'express';
import { DocumentosController, documentosUpload } from '../controllers/documentos.controller';
import { authMiddleware } from '../shared/middlewares/auth.middleware';
import { requireRole } from '../shared/middlewares/role.middleware';

const router = Router();
const controller = new DocumentosController();

const handle = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const fornecedorOuContador = requireRole('fornecedor', 'contador') as RequestHandler;

router.use(authMiddleware as RequestHandler);
router.use(fornecedorOuContador);

router.get('/storage-status', handle(controller.storageStatus.bind(controller) as RequestHandler));
router.get('/', handle(controller.listar.bind(controller) as RequestHandler));
router.post('/upload', documentosUpload, handle(controller.criar.bind(controller) as RequestHandler));
router.post('/expedir', handle(controller.expedir.bind(controller) as RequestHandler));
router.get('/:id/download', handle(controller.download.bind(controller) as RequestHandler));
router.delete('/:id', handle(controller.remover.bind(controller) as RequestHandler));

export default router;
