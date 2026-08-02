import { Response } from 'express';
import { AuthRequest } from '../shared/middlewares/auth.middleware';
import { DataPlatformAdminService } from '../services/data-platform/admin.service';

export class DataPlatformAdminController {
  constructor(private readonly service = new DataPlatformAdminService()) {}

  async listJobs(req: AuthRequest, res: Response) {
    const result = await this.service.listJobs({
      source: queryString(req.query.source),
      status: queryString(req.query.status),
      from: queryString(req.query.from),
      to: queryString(req.query.to),
      limit: queryNumber(req.query.limit),
      offset: queryNumber(req.query.offset),
    });
    return res.json({ success: true, ...result });
  }

  async listEvents(req: AuthRequest, res: Response) {
    const result = await this.service.listEvents({
      source: queryString(req.query.source),
      stage: queryString(req.query.stage),
      level: queryString(req.query.level),
      from: queryString(req.query.from),
      to: queryString(req.query.to),
      limit: queryNumber(req.query.limit),
      offset: queryNumber(req.query.offset),
    });
    return res.json({ success: true, ...result });
  }

  async listTasks(req: AuthRequest, res: Response) {
    const result = await this.service.listTasks({
      engine: queryString(req.query.engine),
      status: queryString(req.query.status),
      attempts: queryNumber(req.query.attempts),
      reason: queryString(req.query.reason),
      from: queryString(req.query.from),
      to: queryString(req.query.to),
      limit: queryNumber(req.query.limit),
      offset: queryNumber(req.query.offset),
    });
    return res.json({ success: true, ...result });
  }

  async listCursors(req: AuthRequest, res: Response) {
    const result = await this.service.listCursors({
      source: queryString(req.query.source),
      limit: queryNumber(req.query.limit),
      offset: queryNumber(req.query.offset),
    });
    return res.json({ success: true, ...result });
  }

  async metrics(req: AuthRequest, res: Response) {
    const data = await this.service.getMetrics({
      from: queryString(req.query.from),
      to: queryString(req.query.to),
    });
    return res.json({ success: true, data });
  }

  async runPncpIngestion(req: AuthRequest, res: Response) {
    const result = await this.service.runPncpIngestion(buildFetchInput(req.body), buildContext(req));
    return res.json({ success: true, data: result });
  }

  async runComprasGovIngestion(req: AuthRequest, res: Response) {
    const result = await this.service.runComprasGovIngestion(buildFetchInput(req.body), buildContext(req));
    return res.json({ success: true, data: result });
  }

  async consumeIndexTasks(req: AuthRequest, res: Response) {
    const result = await this.service.consumeIndexTasks({
      batchSize: bodyNumber(req.body?.batchSize),
      maxAttempts: bodyNumber(req.body?.maxAttempts),
      retryBaseDelayMs: bodyNumber(req.body?.retryBaseDelayMs),
      tenantId: nullableBodyString(req.body?.tenantId),
      engine: bodyString(req.body?.engine),
      traceId: bodyString(req.body?.traceId),
    }, buildContext(req));
    return res.json({ success: true, data: result });
  }

  async requeueSkipped(req: AuthRequest, res: Response) {
    const result = await this.service.requeueSkippedTasks(buildRequeueInput(req.body), buildContext(req));
    return res.json({ success: true, data: result });
  }

  async requeueFailed(req: AuthRequest, res: Response) {
    const result = await this.service.requeueFailedTasks(buildRequeueInput(req.body), buildContext(req));
    return res.json({ success: true, data: result });
  }

  async cleanupOldTasks(req: AuthRequest, res: Response) {
    const result = await this.service.cleanupOldTasks({
      olderThanDays: bodyNumber(req.body?.olderThanDays),
      tenantId: nullableBodyString(req.body?.tenantId),
    }, buildContext(req));
    return res.json({ success: true, data: result });
  }
}

function buildFetchInput(body: any) {
  return {
    tenantId: nullableBodyString(body?.tenantId),
    limit: bodyNumber(body?.limit),
    since: bodyString(body?.since),
    filters: body && typeof body.filters === 'object' && !Array.isArray(body.filters) ? body.filters : {},
    traceId: bodyString(body?.traceId),
  };
}

function buildRequeueInput(body: any) {
  return {
    engine: bodyString(body?.engine),
    reason: bodyString(body?.reason),
    olderThanMinutes: bodyNumber(body?.olderThanMinutes),
    maxAttempts: bodyNumber(body?.maxAttempts),
    limit: bodyNumber(body?.limit),
    tenantId: nullableBodyString(body?.tenantId),
  };
}

function buildContext(req: AuthRequest) {
  return {
    user: {
      id: req.user?.id as string,
      email: req.user?.email ?? null,
      role: req.user?.role ?? null,
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

function queryString(value: unknown) {
  if (Array.isArray(value)) return queryString(value[0]);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function queryNumber(value: unknown) {
  const number = Number(queryString(value));
  return Number.isFinite(number) ? number : undefined;
}

function bodyString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function nullableBodyString(value: unknown) {
  if (value === null) return null;
  return bodyString(value);
}

function bodyNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}
