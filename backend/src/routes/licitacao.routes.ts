import { Router } from 'express';
import { LicitacaoController } from '../controllers/licitacao.controller';

const router = Router();
const controller = new LicitacaoController();

// GET /api/licitacoes?q=caneta&uf=CE&fonte=TODAS
router.get('/', (req, res) => controller.buscar(req, res));

// GET /api/licitacoes/preco-referencia?descricao=papel+a4&uf=SP
router.get('/preco-referencia', (req, res) => controller.precoReferencia(req, res));

// GET /api/licitacoes/fornecedores/:cnpj/risco
router.get('/fornecedores/:cnpj/risco', (req, res) => controller.checarRiscoFornecedor(req, res));

export default router;