import { Request, Response } from 'express';
import { AuditAdminService } from '../services/audit-admin.service';

export class AuditAdminController {
  constructor(private readonly service = new AuditAdminService()) {}

  async listEvents(req: Request, res: Response) {
    const result = await this.service.listEvents({
      scope: queryString(req.query.scope),
      action: queryString(req.query.action),
      outcome: queryString(req.query.outcome),
      userId: queryString(req.query.userId),
      entity: queryString(req.query.entity),
      from: queryString(req.query.from),
      to: queryString(req.query.to),
      limit: queryNumber(req.query.limit),
      offset: queryNumber(req.query.offset),
    });

    return res.json({ success: true, ...result });
  }

  async metrics(req: Request, res: Response) {
    const data = await this.service.getMetrics({
      scope: queryString(req.query.scope),
      from: queryString(req.query.from),
      to: queryString(req.query.to),
    });

    return res.json({ success: true, data });
  }
}

function queryString(value: unknown) {
  if (Array.isArray(value)) return queryString(value[0]);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function queryNumber(value: unknown) {
  const number = Number(queryString(value));
  return Number.isFinite(number) ? number : undefined;
}
