import { Response } from 'express';
import { ZodError } from 'zod';
import { LegalPrecheckService } from '../services/legal-precheck.service';
import { NoticesSearchService } from '../services/notices-search.service';
import { NoticesErrorRadarService } from '../services/notices-error-radar.service';
import { NoticesOpportunityScoreService } from '../services/notices-opportunity-score.service';
import { NoticesProposalStrategyService } from '../services/notices-proposal-strategy.service';
import { NoticesPricingStrategyService } from '../services/notices-pricing-strategy.service';
import { documentGenerationService } from '../services/document-generation.service';
import { AuthRequest } from '../shared/middlewares/auth.middleware';
import { prisma } from '../database/prisma';
import { gerarEsqueletoImpugnacao } from '../services/impugnacao.service';
import { preencherTextoEditalAutomaticamente, obterTextoEAnexosOficiais, ResultadoExtracaoEdital } from '../services/pncp-parser.service';
import { EditalDeepAnalyzerService } from '../services/edital-deep-analyzer.service';

export class NoticesController {
  constructor(
    private readonly service = new NoticesSearchService(),
    private readonly legalPrecheck = new LegalPrecheckService(),
    private readonly errorRadar = new NoticesErrorRadarService(),
    private readonly opportunityScore = new NoticesOpportunityScoreService(),
    private readonly proposalStrategy = new NoticesProposalStrategyService(),
    private readonly pricingStrategy = new NoticesPricingStrategyService(),
  ) {}

  async search(req: AuthRequest, res: Response) {
    try {
      const result = await this.service.search(req.query, buildContext(req));
      return res.json({ success: true, ...result });
    } catch (error) {
      if (error instanceof ZodError) return validationError(res, error);
      throw error;
    }
  }

  async getById(req: AuthRequest, res: Response) {
    try {
      const result = await this.service.getNoticeById(req.params.id, req.query, buildContext(req));
      if (!result) {
        return res.status(404).json({ success: false, message: 'Edital nao encontrado' });
      }
      return res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof ZodError) return validationError(res, error);
      throw error;
    }
  }

  async chunks(req: AuthRequest, res: Response) {
    try {
      const noticeId = req.params.id;

      // 1. Obtém dados com fonte real e lista de arquivos oficiais do PNCP
      let extraInfo: ResultadoExtracaoEdital = {
        sourceMode: 'APENAS_METADADOS_PNCP',
        arquivosOficiais: [],
        text: '',
        chunks: [],
      };
      try {
        extraInfo = await obterTextoEAnexosOficiais(noticeId);
      } catch (parserErr) {
        console.warn('[NoticesController] Aviso ao extrair fonte e anexos oficiais:', parserErr);
      }

      // 2. Obtém auditoria determinística do edital
      let auditoriaSpecs: any = null;
      try {
        auditoriaSpecs = await EditalDeepAnalyzerService.processarEditalPorId(noticeId);
      } catch (deepErr) {
        console.warn('[NoticesController] Aviso ao processar auditoria profunda:', deepErr);
      }

      // 3. Obtém chunks paginados
      const result = await this.service.listChunks(noticeId, req.query, buildContext(req));
      if (!result) {
        return res.status(404).json({ success: false, message: 'Edital nao encontrado' });
      }

      return res.json({
        success: true,
        sourceMode: extraInfo.sourceMode,
        arquivosOficiais: extraInfo.arquivosOficiais,
        auditoriaDeterministica: auditoriaSpecs?.auditoria || (auditoriaSpecs ? {
          status: auditoriaSpecs.pontosDeAtencaoERiscos?.length > 0 ? 'IRREGULARIDADE_DETECTADA' : 'CONFORME',
          mensagem: auditoriaSpecs.pontosDeAtencaoERiscos?.length > 0
            ? `Detectados ${auditoriaSpecs.pontosDeAtencaoERiscos.length} ponto(s) de atenção.`
            : 'Nenhuma cláusula restritiva ou vício formal típico foi encontrado no texto analisado.',
          totalVicios: auditoriaSpecs.pontosDeAtencaoERiscos?.length || 0,
          apontamentos: auditoriaSpecs.pontosDeAtencaoERiscos || [],
        } : null),
        fichaSpecs: auditoriaSpecs,
        ...result,
      });
    } catch (error) {
      if (error instanceof ZodError) return validationError(res, error);
      throw error;
    }
  }

  async analisarPdf(req: AuthRequest, res: Response) {
    try {
      const noticeId = req.params.id;
      const { text, pdfBase64, fileName } = (req.body || {}) as { text?: string; pdfBase64?: string; fileName?: string };

      let textoParaAnalisar = text || '';

      if (!textoParaAnalisar && pdfBase64) {
        try {
          const buf = Buffer.from(pdfBase64, 'base64');
          let pdfParseModule: any = require('pdf-parse');
          const pdfFn = typeof pdfParseModule === 'function' ? pdfParseModule : pdfParseModule?.default || pdfParseModule;
          const pdfData = await pdfFn(buf);
          textoParaAnalisar = String(pdfData?.text || '').trim();
        } catch (parseErr: any) {
          return res.status(400).json({ success: false, message: 'Falha ao processar arquivo PDF: ' + parseErr.message });
        }
      }

      if (!textoParaAnalisar || textoParaAnalisar.length < 30) {
        return res.status(400).json({ success: false, message: 'O arquivo PDF enviado não contém texto legível ou pesquisável.' });
      }

      let notice = null;
      if (noticeId && noticeId !== 'manual') {
        notice = await prisma.procurementNotice.findFirst({
          where: {
            OR: [{ id: noticeId }, { externalId: noticeId }, { dedupeKey: `pncp-${noticeId}` }],
          },
          include: { items: true },
        });
      }

      const ficha = EditalDeepAnalyzerService.analisarTextoIntegral(notice || {}, [textoParaAnalisar], notice?.items || []);

      return res.json({
        success: true,
        sourceMode: 'PDF_ANEXO_REAL',
        text: textoParaAnalisar,
        fileName: fileName || 'edital-manual.pdf',
        auditoria: ficha.auditoria,
        fichaSpecs: ficha,
      });
    } catch (error: any) {
      console.error('[NoticesController] Erro em analisarPdf:', error);
      return res.status(500).json({ success: false, message: error?.message || 'Erro ao analisar PDF enviado' });
    }
  }

  async basicSummary(req: AuthRequest, res: Response) {
    try {
      const result = await this.service.getNoticeBasicSummary(req.params.id, buildContext(req));

      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'Edital nao encontrado',
        });
      }

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof ZodError) return validationError(res, error);
      throw error;
    }
  }

  async summary(req: AuthRequest, res: Response) {
    try {
      const result = await this.service.getNoticeSummary(req.params.id, buildContext(req));
      if (!result) {
        return res.status(404).json({ success: false, message: 'Edital nao encontrado' });
      }
      return res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof ZodError) return validationError(res, error);
      throw error;
    }
  }

  async legalPrecheckReport(req: AuthRequest, res: Response) {
    try {
      const result = await this.legalPrecheck.analyzeNotice(req.params.id, buildContext(req));
      if (!result) {
        return res.status(404).json({ success: false, message: 'Edital nao encontrado' });
      }
      return res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof ZodError) return validationError(res, error);
      throw error;
    }
  }

  async errorRadarReport(req: AuthRequest, res: Response) {
    try {
      const result = await this.errorRadar.analyzeNotice(req.params.id, buildContext(req));
      if (!result) {
        return res.status(404).json({ success: false, message: 'Edital nao encontrado' });
      }
      return res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof ZodError) return validationError(res, error);
      throw error;
    }
  }

  async opportunityScoreReport(req: AuthRequest, res: Response) {
    try {
      const result = await this.opportunityScore.scoreNotice(req.params.id, req.query, buildContext(req));
      if (!result) {
        return res.status(404).json({ success: false, message: 'Edital nao encontrado' });
      }
      return res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof ZodError) return validationError(res, error);
      throw error;
    }
  }

  async batchOpportunityScore(req: AuthRequest, res: Response) {
    try {
      const body = (req.body || {}) as { noticeIds?: string[]; ids?: string[] };
      const rawIds = Array.isArray(body.noticeIds) ? body.noticeIds : Array.isArray(body.ids) ? body.ids : [];
      const targetIds = rawIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);

      if (!targetIds.length) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_INPUT',
          message: 'Informe uma lista de IDs de editais (noticeIds).',
        });
      }

      // Limita lote para proteger memória e concorrência
      const limitedIds = targetIds.slice(0, 30);
      const context = buildContext(req);

      const scorePromises = limitedIds.map(async (id) => {
        try {
          const score = await this.opportunityScore.scoreNotice(id, req.query, context);
          return { noticeId: id, success: Boolean(score), data: score };
        } catch (err: any) {
          return { noticeId: id, success: false, data: null, error: err?.message || 'Falha ao calcular score' };
        }
      });

      const results = await Promise.all(scorePromises);

      return res.json({
        success: true,
        data: results,
        total: results.length,
      });
    } catch (error) {
      if (error instanceof ZodError) return validationError(res, error);
      throw error;
    }
  }

  async proposalStrategyReport(req: AuthRequest, res: Response) {
    try {
      const input = { ...(req.query ?? {}), ...(req.body ?? {}) };
      const result = await this.proposalStrategy.buildStrategy(req.params.id, input, buildContext(req));
      if (!result) {
        return res.status(404).json({ success: false, message: 'Edital nao encontrado' });
      }
      return res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof ZodError) return validationError(res, error);
      throw error;
    }
  }

  async pricingStrategyReport(req: AuthRequest, res: Response) {
    try {
      const input = { ...(req.query ?? {}), ...(req.body ?? {}) };
      const result = await this.pricingStrategy.buildPricingStrategy(req.params.id, input, buildContext(req));
      if (!result) {
        return res.status(404).json({ success: false, message: 'Edital nao encontrado' });
      }
      return res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof ZodError) return validationError(res, error);

      if (error instanceof Error && error.message.startsWith('INVALID_')) {
        return res.status(400).json({
          success: false,
          message: 'Dados inválidos para precificação estratégica',
          code: error.message,
        });
      }

      throw error;
    }
  }

  async generateProposalDocument(req: AuthRequest, res: Response) {
    try {
      const template = await prisma.documentTemplate.findFirst({
        where: { templateType: 'proposta', active: true },
        orderBy: { createdAt: 'desc' }
      });

      if (!template) {
        return res.status(404).json({ success: false, message: 'Template de proposta não encontrado.' });
      }

      const input = { ...(req.query ?? {}), ...(req.body ?? {}) };
      const strategy = await this.proposalStrategy.buildStrategy(req.params.id, input, buildContext(req));
      const notice = await this.service.getNoticeById(req.params.id, {}, buildContext(req));

      if (!strategy || !notice) {
        return res.status(404).json({ success: false, message: 'Edital não encontrado para gerar proposta.' });
      }

      const doc = await documentGenerationService.generateDocument({
        templateId: template.id,
        format: 'docx',
        mergeData: {
          ORGAO_LICITANTE: String(notice.buyerName || 'Órgão Não Informado'),
          NUMERO_EDITAL: String(notice.noticeNumber || notice.id),
          RAZAO_SOCIAL: String((input as any).razaoSocial || 'EMPRESA PADRÃO LTDA'),
          CNPJ: String((input as any).cnpj || '00.000.000/0001-00'),
          ENDERECO_COMPLETO: String((input as any).endereco || 'Rua Padrão, 123'),
          TABELA_ITENS_PROPOSTA: 'Item 1 - Conforme Edital\nItem 2 - Conforme Edital',
          VALOR_TOTAL_GLOBAL: String((input as any).valorGlobal || '0,00'),
          VALOR_GLOBAL_EXTENSO: 'Zero reais',
          PRAZO_VALIDADE_DIAS: '60',
          CIDADE: 'Brasília/DF',
          DATA_ATUAL: new Date().toLocaleDateString('pt-BR'),
          REPRESENTANTE_LEGAL: String((input as any).representante || 'Representante Legal')
        },
        tenantId: req.user?.tenantId ?? undefined
      });

      res.setHeader('Content-Type', doc.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${doc.filename}"`);
      return res.send(doc.buffer);
    } catch (error) {
      if (error instanceof ZodError) return validationError(res, error);
      return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Erro interno.' });
    }
  }

  async minutaImpugnacaoReport(req: AuthRequest, res: Response) {
    try {
      const noticeId = req.params.id;
      const notice = await prisma.procurementNotice.findFirst({
        where: {
          OR: [{ id: noticeId }, { externalId: noticeId }, { dedupeKey: `pncp-${noticeId}` }],
        },
      });

      if (!notice) {
        return res.status(404).json({ success: false, message: 'Edital não encontrado para geração da minuta' });
      }

      const radar = await this.errorRadar.analyzeNotice(notice.id, buildContext(req));
      const company = req.user?.id ? await prisma.company.findFirst({ where: { userId: req.user.id } }) : null;

      const pontosImpugnacao = radar?.issues?.length
        ? radar.issues.map((issue) => `${issue.title}. ${issue.description} Recomendação: ${issue.recommendation}`)
        : ['Exigência editalícia com potencial restrição à ampla competitividade (Art. 9º, I, Lei 14.133/2021)'];

      const dataCertame = notice.openingAt
        ? new Date(notice.openingAt).toISOString().split('T')[0]
        : new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];

      const peca = gerarEsqueletoImpugnacao({
        orgao: notice.buyerName || 'Órgão Licitante Convocador',
        setorResponsavel: 'Comissão de Contratação / Agente de Contratação / Pregoeiro',
        modalidade: notice.modality || 'Pregão Eletrônico',
        numeroEdital: notice.noticeNumber || notice.externalId || 'S/N',
        processoAdministrativo: notice.processoAdministrativo || 'Processo Administrativo Oficial',
        objeto: notice.object,
        criterioJulgamento: notice.judgmentCriterion || 'Menor Preço / Maior Desconto',
        plataforma: notice.url || 'Portal Oficial de Compras',
        dataCertame,
        nomeEmpresa: company?.razaoSocial || req.user?.nome || 'EMPRESA LICITANTE INTERESSADA',
        cnpjEmpresa: company?.cnpj || '00.000.000/0001-00',
        representanteLegal: req.user?.nome || 'Representante Legal',
        pontosImpugnacao,
        formato: 'markdown',
      });

      return res.json({
        success: true,
        data: {
          conteudo: peca.conteudo,
          prazo: peca.prazo,
          edital: notice.noticeNumber || notice.externalId || notice.object.substring(0, 50),
          orgao: notice.buyerName,
          dataCertame,
          irregularidades: radar?.issues || [],
        },
      });
    } catch (error) {
      console.error('[NoticesController] Erro ao gerar minuta:', error);
      return res.status(500).json({ success: false, message: 'Erro ao gerar minuta de impugnação' });
    }
  }

  async deepRead(req: AuthRequest, res: Response) {
    try {
      const noticeId = req.params.id;
      const notice = await prisma.procurementNotice.findFirst({
        where: {
          OR: [{ id: noticeId }, { externalId: noticeId }, { dedupeKey: `pncp-${noticeId}` }],
        },
      });

      if (!notice) {
        return res.status(404).json({ success: false, message: 'Edital não encontrado para leitura profunda' });
      }

      const force = req.query.force === 'true' || req.body?.force === true;
      const meta = (notice.metadata as Record<string, any>) || {};
      if (!force && meta.extractedSpecsJson && meta.deepReadStatus === 'COMPLETO') {
        return res.json({
          success: true,
          data: {
            noticeId: notice.id,
            status: 'COMPLETO',
            specs: meta.extractedSpecsJson,
          },
        });
      }

      // 1. Extração dos arquivos reais (PDF / DOCX / ZIP) caso ainda não estejam em document_chunks
      await preencherTextoEditalAutomaticamente(notice.id);

      // 2. Análise profunda e estruturada (especificações, riscos, regras de disputa e execução)
      const ficha = await EditalDeepAnalyzerService.processarEditalPorId(notice.id);

      return res.json({
        success: true,
        data: {
          noticeId: notice.id,
          status: ficha ? 'COMPLETO' : 'SEM_ARQUIVOS',
          specs: ficha,
        },
      });
    } catch (error: any) {
      console.error('[NoticesController] Erro na leitura profunda do edital:', error);
      return res.status(500).json({ success: false, message: error?.message || 'Erro ao processar leitura profunda do edital' });
    }
  }
}

function buildContext(req: AuthRequest) {
  return {
    tenantId: req.user?.tenantId ?? null,
    user: {
      id: req.user?.id ?? null,
      email: req.user?.email ?? null,
      role: req.user?.role ?? null,
      isAdmin: Boolean(req.user?.isAdmin),
      permissions: req.user?.permissions ?? [],
    },
    requestId: req.headers['x-request-id'] || req.headers['x-correlation-id'],
    ip: clientIp(req),
    userAgent: req.headers['user-agent'],
  };
}

function clientIp(req: AuthRequest) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
}

function validationError(res: Response, error: ZodError) {
  return res.status(400).json({
    success: false,
    message: 'Parametros de busca invalidos',
    errors: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  });
}
