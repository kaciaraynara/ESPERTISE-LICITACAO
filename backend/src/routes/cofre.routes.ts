import { Router } from 'express';
import { CofreController } from '../controllers/cofre.controller';

const router = Router();
const controller = new CofreController();

router.get('/documentos', (req, res) => controller.listarDocumentos(req, res));
router.get('/metricas', (req, res) => controller.getMetricas(req, res));

export default router;