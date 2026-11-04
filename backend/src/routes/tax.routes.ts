import { Router } from 'express';
import { taxController } from '../controllers/tax.controller';

const router = Router();

// Rota de simulação BDI & Split Payment
router.post('/simulate-bdi', taxController.simulateBdi);

export default router;

