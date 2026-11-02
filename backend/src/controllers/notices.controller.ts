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
      const result = await this.service.listChunks(req.params.id, req.query, buildContext(req));
      if (!result) {
        return res.status(404).json({ success: false, message: 'Edital nao encontrado' });
      }
      return res.json({ success: true, ...result });
    } catch (error) {
      if (error instanceof ZodError) return validationError(res, error);
      throw error;
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
