import { Request, Response } from 'express';
import multer from 'multer';
import { calcularSimulacaoBdi } from '../services/tax-bdi.service';
import { SimulateBdiInput } from '../types/war-room.types';
import { expertiseFiscalEngineService } from '../services/expertise-fiscal-engine.service';
import { AuthRequest } from '../shared/middlewares/auth.middleware';
import { prisma } from '../database/prisma';

export const fiscalUploadParser = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // até 25MB para arquivos SPED grandes
    files: 1,
  },
}).single('file');

export class TaxController {
  private async resolveEffectiveCompany(req: AuthRequest): Promise<{ tenantId: string; companyId: string }> {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new Error('Tenant não identificado no contexto do usuário autenticado.');
    }

    let companyId = req.companyId;
    if (!companyId) {
      const explicit = (req.headers['x-company-id'] || req.body?.companyId || req.query?.companyId) as string | undefined;
      if (explicit && typeof explicit === 'string') {
        const found = await prisma.company.findFirst({
          where: { id: explicit.trim(), tenantId },
          select: { id: true },
        });
        if (found) companyId = found.id;
      }
    }

    if (!companyId && req.user?.id) {
      const first = await prisma.company.findFirst({
        where: { userId: req.user.id, tenantId },
        select: { id: true },
      });
      if (first) companyId = first.id;
    }

    if (!companyId) {
      throw new Error('Nenhuma empresa ativa vinculada foi encontrada.');
    }

    return { tenantId, companyId };
  }

  /**
   * POST /api/tax/simulate-bdi
   * Rota legado de simulação rápida de BDI
   */
  public simulateBdi = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { custoInsumos, despesasOperacionais, margemLucroDesejada, margemMinimaStopLoss, bidAmount } = req.body;

      if (custoInsumos === undefined || isNaN(Number(custoInsumos))) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_INPUT',
          message: 'O campo custoInsumos é obrigatório e deve ser um número válido.',
        });
      }

      const input: SimulateBdiInput = {
        custoInsumos: Number(custoInsumos),
        despesasOperacionais: despesasOperacionais !== undefined ? Number(despesasOperacionais) : undefined,
        margemLucroDesejada: margemLucroDesejada !== undefined ? Number(margemLucroDesejada) : undefined,
        margemMinimaStopLoss: margemMinimaStopLoss !== undefined ? Number(margemMinimaStopLoss) : undefined,
        bidAmount: bidAmount !== undefined ? Number(bidAmount) : undefined,
      };

      const result = calcularSimulacaoBdi(input);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('[TaxController] Falha na simulação de BDI:', error);
      return res.status(500).json({
        success: false,
        code: 'INTERNAL_TAX_CALCULATION_ERROR',
        message: 'Falha ao processar simulação tributária de BDI.',
      });
    }
  };

  /**
   * POST /api/tax/fiscal/import-xml
   * Importação e diagnóstico automático de XML NF-e ou TXT SPED
   */
  public importFiscalXml = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const { tenantId, companyId } = await this.resolveEffectiveCompany(req);

      let filename = 'documento.xml';
      let fileContent = '';

      if (req.file) {
        filename = req.file.originalname || filename;
        fileContent = req.file.buffer.toString('utf-8');
      } else if (req.body?.fileContent) {
        filename = req.body?.filename || filename;
        fileContent = String(req.body.fileContent);
      } else if (req.body?.xmlContent) {
        filename = req.body?.filename || filename;
        fileContent = String(req.body.xmlContent);
      }

      if (!fileContent.trim()) {
        return res.status(400).json({
          success: false,
          code: 'EMPTY_FILE',
          message: 'Nenhum conteúdo de arquivo XML ou SPED foi fornecido.',
        });
      }

      const result = await expertiseFiscalEngineService.importAndDiagnoseFiscalDocument({
        tenantId,
        companyId,
        userId: req.user?.id,
        filename,
        fileContent,
      });

      return res.status(201).json({
        success: true,
        data: result,
        message: 'Documento fiscal importado e auditado com sucesso.',
      });
    } catch (error: any) {
      console.error('[TaxController] Falha ao importar documento fiscal:', error);
      return res.status(error.message?.includes('já foi importado') ? 409 : 400).json({
        success: false,
        code: 'FISCAL_IMPORT_ERROR',
        message: error.message || 'Erro ao processar importação de documento fiscal.',
      });
    }
  };

  /**
   * GET /api/tax/fiscal/credits
   * Lista oportunidades de créditos tributários da empresa
   */
  public listTaxCredits = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const { tenantId, companyId } = await this.resolveEffectiveCompany(req);
      const status = req.query.status as string | undefined;
      const originCategory = req.query.originCategory as string | undefined;

      const credits = await expertiseFiscalEngineService.listCreditOpportunities({
        tenantId,
        companyId,
        status,
        originCategory,
      });

      return res.status(200).json({
        success: true,
        data: credits,
      });
    } catch (error: any) {
      console.error('[TaxController] Falha ao listar créditos tributários:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao carregar oportunidades de crédito tributário.',
      });
    }
  };

  /**
   * GET /api/tax/fiscal/documents
   * Lista documentos fiscais importados pela empresa
   */
  public listImportedDocuments = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const { tenantId, companyId } = await this.resolveEffectiveCompany(req);

      const docs = await expertiseFiscalEngineService.listImportedDocuments({
        tenantId,
        companyId,
      });

      return res.status(200).json({
        success: true,
        data: docs,
      });
    } catch (error: any) {
      console.error('[TaxController] Falha ao listar documentos fiscais:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao carregar documentos fiscais importados.',
      });
    }
  };

  /**
   * POST /api/tax/fiscal/validate-credit/:id
   * Validação técnica formal do crédito por profissional (CRC/OAB)
   */
  public validateCredit = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const { tenantId, companyId } = await this.resolveEffectiveCompany(req);
      const creditId = req.params.id;
      const { validatedByProfessionalName, validatedByRegistryCrcOab, perdcompProtocol } = req.body;

      if (!validatedByProfessionalName || !validatedByRegistryCrcOab) {
        return res.status(400).json({
          success: false,
          message: 'Nome do profissional responsável e registro CRC/OAB são obrigatórios.',
        });
      }

      const updated = await expertiseFiscalEngineService.validateCreditOpportunity({
        tenantId,
        companyId,
        creditId,
        validatedByProfessionalName,
        validatedByRegistryCrcOab,
        perdcompProtocol,
      });

      return res.status(200).json({
        success: true,
        data: updated,
        message: 'Crédito tributário validado com sucesso para fins de compensação.',
      });
    } catch (error: any) {
      console.error('[TaxController] Falha na validação do crédito:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Erro ao validar crédito tributário.',
      });
    }
  };

  /**
   * POST /api/tax/fiscal/simulate-reform
   * Simulação da transição para o IVA Dual (CBS + IBS) e Split Payment
   */
  public simulateTaxReform = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const { tenantId, companyId } = await this.resolveEffectiveCompany(req);
      const { grossRevenueAnnual, targetCnae, taxRegime, operationType } = req.body;

      const result = await expertiseFiscalEngineService.simulateTaxReformTransition({
        tenantId,
        companyId,
        grossRevenueAnnual: grossRevenueAnnual ? Number(grossRevenueAnnual) : undefined,
        targetCnae,
        taxRegime,
        operationType,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('[TaxController] Falha na simulação da Reforma Tributária:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Erro ao processar simulação da Reforma Tributária.',
      });
    }
  };

  /**
   * POST /api/tax/fiscal/simulate-proposal-bdi
   * Simulação da proposta de licitação com trava de 5 etapas e Cenários A & B
   */
  public simulateProposalBdi = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const { tenantId, companyId } = await this.resolveEffectiveCompany(req);
      const {
        noticeId,
        directCost,
        operationalExpenses = 0,
        targetMarginPercent = 15,
        creditOpportunityIds = [],
      } = req.body;

      if (directCost === undefined || Number(directCost) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'O custo direto é obrigatório e deve ser maior que zero.',
        });
      }

      const result = await expertiseFiscalEngineService.simulateBiddingPriceWithTaxIntelligence({
        tenantId,
        companyId,
        noticeId,
        directCost: Number(directCost),
        operationalExpenses: Number(operationalExpenses),
        targetMarginPercent: Number(targetMarginPercent),
        creditOpportunityIds: Array.isArray(creditOpportunityIds) ? creditOpportunityIds : [],
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('[TaxController] Falha na simulação de proposta com inteligência fiscal:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Erro ao simular proposta de licitação com inteligência fiscal.',
      });
    }
  };

  /**
   * POST /api/tax/fiscal/audit
   * Módulo 05: Executa auditoria fiscal inteligente procurando divergências de NCM, CFOP e retenção
   */
  public runSmartFiscalAudit = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const { tenantId, companyId } = await this.resolveEffectiveCompany(req);
      const { noticeId, documentId, orgaoDestinatarioNome, orgaoDestinatarioCnpj } = req.body || {};

      const result = await expertiseFiscalEngineService.runSmartFiscalAudit({
        tenantId,
        companyId,
        noticeId,
        documentId,
        orgaoDestinatarioNome,
        orgaoDestinatarioCnpj,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('[TaxController] Falha na auditoria fiscal inteligente:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Erro ao executar auditoria fiscal inteligente.',
      });
    }
  };

  /**
   * POST /api/tax/fiscal/anexo-iv
   * Gera o modelo preenchido da Declaração de Não Retenção (Anexo IV da IN RFB 1.234/2012)
   */
  public generateAnexoIv = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const { tenantId, companyId } = await this.resolveEffectiveCompany(req);
      const { orgaoDestinatarioNome, orgaoDestinatarioCnpj, cidade, uf } = req.body || {};

      const company = await prisma.company.findUnique({
        where: { id: companyId },
      });

      if (!company) {
        return res.status(404).json({
          success: false,
          message: 'Empresa contratante não encontrada.',
        });
      }

      const enderecoCompleto = [company.municipio, company.uf]
        .filter(Boolean)
        .join(' - ') || 'Sede da Empresa';

      const declaracao = expertiseFiscalEngineService.generateAnexoIVDeclaration({
        empresaRazaoSocial: company.razaoSocial,
        empresaCnpj: company.cnpj,
        empresaEnderecoCompleto: enderecoCompleto,
        orgaoDestinatarioNome,
        orgaoDestinatarioCnpj,
        cidade: cidade || company.municipio || undefined,
        uf: uf || company.uf || undefined,
        dataEmissao: new Date(),
      });

      return res.status(200).json({
        success: true,
        data: declaracao,
      });
    } catch (error: any) {
      console.error('[TaxController] Falha ao gerar Declaração Anexo IV:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Erro ao gerar Declaração Anexo IV da IN RFB 1.234/2012.',
      });
    }
  };

  /**
   * POST /api/tax/fiscal/perdcomp-cross-offset
   * Módulo 07: Prepara espelho do PER/DCOMP Web e calcula compensação cruzada na DCTFWeb
   */
  public preparePerdcompAndCrossOffset = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const { tenantId, companyId } = await this.resolveEffectiveCompany(req);
      const { creditIds, validationPayload, debitosParaCompensar, protocolosParaRegistrar } = req.body || {};

      const result = await expertiseFiscalEngineService.preparePerdcompAndCrossOffset({
        tenantId,
        companyId,
        creditIds: Array.isArray(creditIds) ? creditIds : undefined,
        validationPayload,
        debitosParaCompensar: Array.isArray(debitosParaCompensar) ? debitosParaCompensar : undefined,
        protocolosParaRegistrar: Array.isArray(protocolosParaRegistrar) ? protocolosParaRegistrar : undefined,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('[TaxController] Falha na preparação do PER/DCOMP e Compensação Cruzada:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Erro ao preparar PER/DCOMP e Compensação Cruzada DCTFWeb.',
      });
    }
  };
}

export const taxController = new TaxController();
