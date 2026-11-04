import { Router } from 'express';
import { LicitacoesController } from '../controllers/licitacoes.controller';

const router = Router();
const controller = new LicitacoesController();

router.get('/', controller.listar.bind(controller));
router.get('/:id', controller.buscarPorId.bind(controller));

export default router;

