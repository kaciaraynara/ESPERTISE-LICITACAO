import { Request, Response } from 'express';
import { LegalRulesAdminService, LegalRuleValidationError } from '../services/legal-rules-admin.service';
import { AuthRequest } from '../shared/middlewares/auth.middleware';

export class LegalRulesAdminController {
  constructor(private readonly service = new LegalRulesAdminService()) {}

  async listRules(req: Request, res: Response) {
    const result = await this.service.listRules({
      code: queryString(req.query.code),
      category: queryString(req.query.category),
      severity: queryString(req.query.severity),
      active: queryString(req.query.active),
      workflowStatus: queryString(req.query.workflowStatus),
      version: queryString(req.query.version),
      limit: queryNumber(req.query.limit),
      offset: queryNumber(req.query.offset),
    });

    return res.json({ success: true, ...result });
  }

  async getRule(req: Request, res: Response) {
    const result = await this.service.getRule(req.params.id);
    if (!result) return res.status(404).json({ success: false, message: 'Regra juridica nao encontrada' });
    return res.json({ success: true, data: result });
  }

  async createRule(req: AuthRequest, res: Response) {
    try {
      const result = await this.service.createRule(buildMutationInput(req.body), buildContext(req));
      return res.status(201).json({ success: true, data: result });
    } catch (error) {
      return handleValidationError(error, res);
    }
  }

  async updateRule(req: AuthRequest, res: Response) {
    try {
      const result = await this.service.updateRule(req.params.id, buildMutationInput(req.body), buildContext(req));
      return res.json({ success: true, data: result });
    } catch (error) {
      return handleValidationError(error, res);
    }
  }

  async activateRule(req: AuthRequest, res: Response) {
    try {
      const result = await this.service.activateRule(req.params.id, buildContext(req));
      return res.json({ success: true, data: result });
    } catch (error) {
      return handleValidationError(error, res);
    }
  }

  async deactivateRule(req: AuthRequest, res: Response) {
    try {
      const result = await this.service.deactivateRule(req.params.id, buildContext(req));
      return res.json({ success: true, data: result });
    } catch (error) {
      return handleValidationError(error, res);
    }
  }

  async createNewVersion(req: AuthRequest, res: Response) {
    try {
      const result = await this.service.createNewVersion(req.params.id, buildMutationInput(req.body), buildContext(req));
      return res.status(201).json({ success: true, data: result });
    } catch (error) {
      return handleValidationError(error, res);
    }
  }

  async submitReview(req: AuthRequest, res: Response) {
    try {
      const result = await this.service.submitReview(req.params.id, buildContext(req));
      return res.json({ success: true, data: result });
    } catch (error) {
      return handleValidationError(error, res);
    }
  }

  async approveRule(req: AuthRequest, res: Response) {
    try {
      const result = await this.service.approveRule(req.params.id, buildContext(req));
      return res.json({ success: true, data: result });
    } catch (error) {
      return handleValidationError(error, res);
    }
  }

  async rejectRule(req: AuthRequest, res: Response) {
    try {
      const result = await this.service.rejectRule(req.params.id, { reason: bodyString(req.body?.reason) }, buildContext(req));
      return res.json({ success: true, data: result });
    } catch (error) {
      return handleValidationError(error, res);
    }
  }

  async activateApproved(req: AuthRequest, res: Response) {
    try {
      const result = await this.service.activateApprovedRule(req.params.id, buildContext(req));
      return res.json({ success: true, data: result });
    } catch (error) {
      return handleValidationError(error, res);
    }
  }

  async history(req: AuthRequest, res: Response) {
    try {
      const result = await this.service.history(req.params.id, buildContext(req));
      return res.json({ success: true, data: result });
    } catch (error) {
      return handleValidationError(error, res);
    }
  }

  async diff(req: AuthRequest, res: Response) {
    try {
      const result = await this.service.diff(req.params.id, req.params.compareId, buildContext(req));
      return res.json({ success: true, data: result });
    } catch (error) {
      return handleValidationError(error, res);
    }
  }
}

function buildMutationInput(body: any) {
  return {
    code: bodyString(body?.code),
    name: bodyString(body?.name),
    description: bodyString(body?.description),
    severity: bodyString(body?.severity),
    category: bodyString(body?.category),
    legalBasis: plainObject(body?.legalBasis),
    version: bodyString(body?.version),
    active: body?.active,
    criteria: plainObject(body?.criteria),
    alertMessage: bodyString(body?.alertMessage),
    recommendation: bodyString(body?.recommendation),
    metadata: plainObject(body?.metadata),
    tenantId: bodyString(body?.tenantId),
  };
}

function buildContext(req: AuthRequest) {
  return {
    user: req.user ? {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
    } : null,
    requestId: req.headers['x-request-id'],
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  };
}

function handleValidationError(error: unknown, res: Response) {
  if (error instanceof LegalRuleValidationError) {
    const status = /nao encontrada/i.test(error.message) ? 404 : 400;
    return res.status(status).json({ success: false, message: error.message });
  }
  throw error;
}

function queryString(value: unknown) {
  if (Array.isArray(value)) return bodyString(value[0]);
  return bodyString(value);
}

function queryNumber(value: unknown) {
  const raw = queryString(value);
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function bodyString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function plainObject(value: unknown): Record<string, unknown> | null {
  if (value === undefined) return undefined as any;
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
