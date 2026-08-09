import { Router } from 'express';
import { AnaliseViabilidadeController } from '../controllers/analise-viabilidade.controller';

const router = Router();
const controller = new AnaliseViabilidadeController();

// GET /api/analise-viabilidade/:editalId
router.get('/:editalId', (req, res) => controller.getAnalisePorEdital(req, res));

export default router;