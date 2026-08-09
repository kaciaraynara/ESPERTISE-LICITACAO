import { Router } from 'express';
import { CrmController } from '../controllers/crm.controller';

const router = Router();
const controller = new CrmController();

router.get('/oportunidades', (req, res) => controller.listarOportunidades(req, res));
router.patch('/oportunidades/:id/etapa', (req, res) => controller.atualizarEtapa(req, res));
router.get('/metricas', (req, res) => controller.getMetricas(req, res));

export default router;