import { Router, RequestHandler } from 'express';
import { habilitacaoController } from '../controllers/habilitacao.controller';
import { authMiddleware } from '../shared/middlewares/auth.middleware';
import { documentosUpload } from '../controllers/documentos.controller';

const router = Router();

const handle = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

router.use(authMiddleware as RequestHandler);

// GET /api/v1/habilitacao/status — Consulta situação dos 13 documentos
router.get('/status', handle(habilitacaoController.getStatus.bind(habilitacaoController) as RequestHandler));

// POST /api/v1/habilitacao/emitir-gratuitos — Emissão automática silenciosa
router.post('/emitir-gratuitos', handle(habilitacaoController.emitirGratuitos.bind(habilitacaoController) as RequestHandler));

// POST /api/v1/habilitacao/anexar — Anexar arquivo para qualquer um dos 13 documentos
router.post('/anexar', documentosUpload, handle(habilitacaoController.anexarDocumento.bind(habilitacaoController) as RequestHandler));

// GET /api/v1/habilitacao/baixar-pasta-completa — Download do zip organizado na ordem da Lei
router.get('/baixar-pasta-completa', handle(habilitacaoController.baixarPastaCompleta.bind(habilitacaoController) as RequestHandler));

export default router;
