import { Router, RequestHandler } from 'express';
import { DocumentTemplatesController } from '../controllers/document-templates.controller';
import { authMiddleware } from '../shared/middlewares/auth.middleware';

const router = Router();
const controller = new DocumentTemplatesController();

const handle = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

router.use(authMiddleware as RequestHandler);

router.get('/', handle(controller.listar.bind(controller) as RequestHandler));
router.post('/:id/gerar', handle(controller.gerar.bind(controller) as RequestHandler));

export default router;
