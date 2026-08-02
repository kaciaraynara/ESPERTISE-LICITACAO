import { Response } from 'express';
import { ZodError } from 'zod';
import { LegalPrecheckService } from '../services/legal-precheck.service';
import { NoticesSearchService } from '../services/notices-search.service';
import { NoticesErrorRadarService } from '../services/notices-error-radar.service';
import { NoticesOpportunityScoreService } from '../services/notices-opportunity-score.service';
import { NoticesProposalStrategyService } from '../services/notices-proposal-strategy.service';
import { NoticesPricingStrategyService } from '../services/notices-pricing-strategy.service';
import { AuthRequest } from '../shared/middlewares/auth.middleware';

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
