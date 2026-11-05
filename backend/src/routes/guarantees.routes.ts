import { Router } from 'express';
import { guaranteesController } from '../controllers/guarantees.controller';
import { authMiddleware } from '../shared/middlewares/auth.middleware';

const router = Router();

// Todas as rotas de garantias exigem autenticação
router.use(authMiddleware);

router.get('/alerts', guaranteesController.getCertificateAlerts);
router.get('/', guaranteesController.list);
router.post('/', guaranteesController.create);
router.put('/:id', guaranteesController.update);

export default router;

