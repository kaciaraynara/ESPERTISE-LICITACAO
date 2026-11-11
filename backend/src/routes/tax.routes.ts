import { Router } from 'express';
import { taxController, fiscalUploadParser } from '../controllers/tax.controller';
import { authMiddleware, companyContextMiddleware } from '../shared/middlewares/auth.middleware';

const router = Router();

// Rota legado de simulação BDI & Split Payment
router.post('/simulate-bdi', taxController.simulateBdi);

// =============================================================================
// EXPERTISE FISCAL ENGINE (ROTAS MULTI-TENANT & ISOLAMENTO POR EMPRESA)
// =============================================================================

// Módulo 01: Importação de XML NF-e / SPED Fiscal
router.post(
  '/fiscal/import-xml',
  authMiddleware,
  companyContextMiddleware,
  fiscalUploadParser,
  taxController.importFiscalXml,
);

// Módulo 02: Listagem de Oportunidades de Créditos Fiscais Identificados
router.get(
  '/fiscal/credits',
  authMiddleware,
  companyContextMiddleware,
  taxController.listTaxCredits,
);

// Listagem de Documentos Fiscais Importados
router.get(
  '/fiscal/documents',
  authMiddleware,
  companyContextMiddleware,
  taxController.listImportedDocuments,
);

// Validação Técnica Formal do Crédito por Profissional (CRC/OAB)
router.post(
  '/fiscal/validate-credit/:id',
  authMiddleware,
  companyContextMiddleware,
  taxController.validateCredit,
);

// Módulo 03: Simulação de Transição para Reforma Tributária (IVA Dual CBS + IBS)
router.post(
  '/fiscal/simulate-reform',
  authMiddleware,
  companyContextMiddleware,
  taxController.simulateTaxReform,
);

// Módulo 04: Simulação de Proposta com Inteligência Tributária (Trava de 5 Etapas)
router.post(
  '/fiscal/simulate-proposal-bdi',
  authMiddleware,
  companyContextMiddleware,
  taxController.simulateProposalBdi,
);

export default router;
