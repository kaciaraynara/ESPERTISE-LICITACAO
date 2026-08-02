import { Request, Response } from 'express';
import { RbacService } from '../services/rbac.service';
import { AuthRequest } from '../shared/middlewares/auth.middleware';

export class RbacAdminController {
  constructor(private readonly service = new RbacService()) {}

  async listRoles(req: Request, res: Response) {
    const result = await this.service.listRoles({
      scope: queryString(req.query.scope),
      tenantId: queryString(req.query.tenantId),
      module: queryString(req.query.module),
      active: queryString(req.query.active),
      limit: queryNumber(req.query.limit),
      offset: queryNumber(req.query.offset),
    });

    return res.json({ success: true, ...result });
  }

  async createRole(req: Request, res: Response) {
    const result = await this.service.createRole({
      key: bodyString(req.body?.key) ?? '',
      name: bodyString(req.body?.name) ?? '',
      description: bodyString(req.body?.description),
      scope: bodyString(req.body?.scope),
      tenantId: bodyString(req.body?.tenantId),
      module: bodyString(req.body?.module),
      permissionKeys: Array.isArray(req.body?.permissionKeys) ? req.body.permissionKeys : [],
      metadata: plainObject(req.body?.metadata),
    }, buildContext(req as AuthRequest));

    return res.status(201).json({ success: true, data: result });
  }

  async listPermissions(req: Request, res: Response) {
    const result = await this.service.listPermissions({
      module: queryString(req.query.module),
      scope: queryString(req.query.scope),
      limit: queryNumber(req.query.limit),
      offset: queryNumber(req.query.offset),
    });

    return res.json({ success: true, ...result });
  }

  async listUserPermissions(req: Request, res: Response) {
    const userId = bodyString(req.params.userId);
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId e obrigatorio' });
    }

    const result = await this.service.listUserPermissions(userId, queryString(req.query.tenantId));
    return res.json({ success: true, data: result });
  }

  async assignRole(req: Request, res: Response) {
    const result = await this.service.assignRole({
      userId: bodyString(req.body?.userId) ?? '',
      roleId: bodyString(req.body?.roleId),
      roleKey: bodyString(req.body?.roleKey),
      tenantId: bodyString(req.body?.tenantId),
      module: bodyString(req.body?.module),
      expiresAt: bodyString(req.body?.expiresAt),
    }, buildContext(req as AuthRequest));

    return res.status(201).json({ success: true, data: result });
  }

  async revokeRole(req: Request, res: Response) {
    const result = await this.service.revokeRole({
      userId: bodyString(req.body?.userId) ?? '',
      roleId: bodyString(req.body?.roleId),
      roleKey: bodyString(req.body?.roleKey),
      tenantId: bodyString(req.body?.tenantId),
      module: bodyString(req.body?.module),
    }, buildContext(req as AuthRequest));

    return res.json({ success: true, data: result });
  }
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
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
