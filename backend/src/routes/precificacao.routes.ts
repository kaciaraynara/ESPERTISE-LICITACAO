import { Router, Request, Response } from 'express';
import { PricingController } from '../controllers/pricing.controller';
import { PrecificacaoController } from '../controllers/precificacao.controller';

const router = Router();
const pricingController = new PricingController();
const precificacaoController = new PrecificacaoController();

// Definição das rotas de precificação
router.post('/estrategia', pricingController.getPricingStrategy.bind(pricingController));
router.post('/viabilidade', precificacaoController.calcularMargens.bind(precificacaoController));

export default router;