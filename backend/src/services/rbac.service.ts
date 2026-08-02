import { createHash } from 'crypto';
import { prisma } from '../database/prisma';

export const RBAC_PERMISSIONS = {
  DATA_PLATFORM_READ: 'data_platform:read',
  DATA_PLATFORM_OPERATE: 'data_platform:operate',
  DATA_PLATFORM_ADMIN: 'data_platform:admin',
  AUDIT_READ: 'audit:read',
  AUDIT_EXPORT: 'audit:export',
  AUDIT_ADMIN: 'audit:admin',
  USERS_READ: 'users:read',
  USERS_MANAGE: 'users:manage',
  MARKETPLACE_ADMIN: 'marketplace:admin',
  LEGAL_ADMIN: 'legal:admin',
  LEGAL_REVIEW: 'legal:review',
  LEGAL_PUBLISH: 'legal:publish',
  INVESTIGATION_ADMIN: 'investigation:admin',
} as const;

type Scope = 'global' | 'tenant' | 'module';

type ActorUser = {
  id: string;
  email?: string | null;
  role?: string | null;
};

export interface RbacActionContext {
  user?: ActorUser | null;
  requestId?: string | string[] | null;
  ip?: string | null;
  userAgent?: string | string[] | null;
  tenantId?: string | null;
}

interface PaginationInput {
  limit?: number;
  offset?: number;
}

interface ListRolesInput extends PaginationInput {
  scope?: string;
  tenantId?: string | null;
  module?: string | null;
  active?: boolean | string | null;
}

interface ListPermissionsInput extends PaginationInput {
  module?: string | null;
  scope?: string | null;
}

interface CreateRoleInput {
  key: string;
  name: string;
  description?: string | null;
  scope?: Scope | string | null;
  tenantId?: string | null;
  module?: string | null;
  permissionKeys?: string[];
  metadata?: Record<string, unknown> | null;
}

interface RoleMutationInput {
  userId: string;
  roleId?: string | null;
  roleKey?: string | null;
  tenantId?: string | null;
  module?: string | null;
  expiresAt?: string | Date | null;
}

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const SENSITIVE_KEY_PATTERN = /(password|senha|token|secret|authorization|cookie|api[_-]?key|rawpayload|payload|cpf|cnpj|email|ip|useragent)/i;
const VALID_SCOPES = new Set(['global', 'tenant', 'module']);

export class RbacService {
  constructor(
    private readonly client: any = prisma as any,
  ) {}

  async hasPermission(userId: string, permission: string, tenantId?: string | null) {
    const safeUserId = safeString(userId, 80);
    const safePermission = safeString(permission, 120);
    if (!safeUserId || !safePermission) return false;

    const match = await this.client.userRole.findFirst({
      where: {
        userId: safeUserId,
        AND: [
          activeAssignmentWhere(),
          tenantAssignmentWhere(tenantId),
          {
            role: {
              active: true,
              permissions: {
                some: {
                  permission: { key: safePermission },
                },
              },
            },
          },
          {
            role: tenantRoleWhere(tenantId),
          },
        ],
      },
      select: { id: true },
    });

    return Boolean(match);
  }

  async listUserPermissions(userId: string, tenantId?: string | null) {
    const safeUserId = requiredString(userId, 'userId', 80);
    const rows = await this.client.userRole.findMany({
      where: {
        userId: safeUserId,
        AND: [activeAssignmentWhere(), tenantAssignmentWhere(tenantId), { role: tenantRoleWhere(tenantId) }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    const permissions = new Map<string, any>();

    for (const assignment of rows) {
      const role = assignment.role;
      if (!role?.active) continue;

      for (const rolePermission of role.permissions ?? []) {
        const permission = rolePermission.permission;
        if (!permission?.key) continue;

        const existing = permissions.get(permission.key) ?? {
          key: permission.key,
          module: permission.module,
          action: permission.action,
          scope: permission.scope,
          roles: [],
        };

        existing.roles.push({
          id: role.id,
          key: role.key,
          name: role.name,
          scope: role.scope,
          tenantId: role.tenantId ?? null,
          module: role.module ?? null,
          assignmentTenantId: assignment.tenantId ?? null,
          assignmentModule: assignment.module ?? null,
          expiresAt: toIso(assignment.expiresAt),
        });
        permissions.set(permission.key, existing);
      }
    }

    return {
      userId: safeUserId,
      tenantId: normalizeNullableString(tenantId),
      permissions: [...permissions.values()].sort((a, b) => a.key.localeCompare(b.key)),
    };
  }

  async listRoles(input: ListRolesInput = {}) {
    const pagination = normalizePagination(input);
    const rows = await this.client.role.findMany({
      where: compact({
        scope: safeString(input.scope, 60),
        tenantId: safeString(input.tenantId, 120),
        module: safeString(input.module, 120),
        active: booleanValue(input.active),
      }),
      orderBy: [{ system: 'desc' }, { key: 'asc' }],
      skip: pagination.offset,
      take: pagination.limit + 1,
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });

    return paginate(rows.map(mapRole), pagination);
  }

  async listPermissions(input: ListPermissionsInput = {}) {
    const pagination = normalizePagination(input);
    const rows = await this.client.permission.findMany({
      where: compact({
        module: safeString(input.module, 120),
        scope: safeString(input.scope, 60),
      }),
      orderBy: [{ module: 'asc' }, { key: 'asc' }],
      skip: pagination.offset,
      take: pagination.limit + 1,
    });

    return paginate(rows.map(mapPermission), pagination);
  }

  async createRole(input: CreateRoleInput, context: RbacActionContext = {}) {
    const key = requiredKey(input.key, 'key');
    const name = requiredString(input.name, 'name', 160);
    const scope = normalizeScope(input.scope);
    const tenantId = normalizeNullableString(input.tenantId);
    const module = normalizeNullableString(input.module);
    const permissionKeys = normalizePermissionKeys(input.permissionKeys ?? []);
    const existing = await this.client.role.findFirst({ where: { key, tenantId, module }, select: { id: true } });

    if (existing) {
      throw new Error('Role ja existe para este escopo.');
    }

    const permissions = permissionKeys.length
      ? await this.client.permission.findMany({ where: { key: { in: permissionKeys } }, select: { id: true, key: true } })
      : [];
    const missingPermissions = permissionKeys.filter((permissionKey) => !permissions.some((permission: any) => permission.key === permissionKey));
    if (missingPermissions.length) {
      throw new Error(`Permissoes inexistentes: ${missingPermissions.join(', ')}`);
    }

    const role = await this.client.role.create({
      data: {
        key,
        name,
        description: normalizeNullableString(input.description),
        scope,
        tenantId,
        module,
        system: false,
        active: true,
        metadata: sanitizeMetadata(input.metadata),
      },
    });

    if (permissions.length) {
      await this.client.rolePermission.createMany({
        data: permissions.map((permission: any) => ({ roleId: role.id, permissionId: permission.id })),
        skipDuplicates: true,
      });
    }

    await this.auditRbacAction('RBAC_CREATE_ROLE', 'success', context, {
      roleKey: key,
      scope,
      tenantId,
      module,
      permissionKeys,
    }, 'role', role.id);

    return mapRole({
      ...role,
      permissions: permissions.map((permission: any) => ({ permission })),
    });
  }

  async assignRole(input: RoleMutationInput, context: RbacActionContext = {}) {
    const userId = requiredString(input.userId, 'userId', 80);
    const role = await this.resolveRole(input);
    const tenantId = normalizeNullableString(input.tenantId);
    const module = normalizeNullableString(input.module);
    const expiresAt = normalizeDate(input.expiresAt);

    const existing = await this.client.userRole.findFirst({
      where: { userId, roleId: role.id, tenantId, module },
      select: { id: true },
    });

    const assignment = existing
      ? await this.client.userRole.update({
        where: { id: existing.id },
        data: {
          assignedByUserId: context.user?.id ?? null,
          expiresAt,
        },
      })
      : await this.client.userRole.create({
        data: {
          userId,
          roleId: role.id,
          tenantId,
          module,
          assignedByUserId: context.user?.id ?? null,
          expiresAt,
        },
      });

    await this.auditRbacAction('RBAC_ASSIGN_ROLE', 'success', context, {
      targetUserId: userId,
      roleId: role.id,
      roleKey: role.key,
      tenantId,
      module,
      expiresAt: toIso(expiresAt),
    }, 'user_role', assignment.id);

    return {
      id: assignment.id,
      userId,
      role: mapRole({ ...role, permissions: [] }),
      tenantId,
      module,
      expiresAt: toIso(assignment.expiresAt),
    };
  }

  async revokeRole(input: RoleMutationInput, context: RbacActionContext = {}) {
    const userId = requiredString(input.userId, 'userId', 80);
    const role = await this.resolveRole(input);
    const tenantId = normalizeNullableString(input.tenantId);
    const module = normalizeNullableString(input.module);
    const assignments = await this.client.userRole.findMany({
      where: { userId, roleId: role.id, tenantId, module },
      select: { id: true },
    });

    if (assignments.length) {
      await this.client.userRole.deleteMany({
        where: { id: { in: assignments.map((assignment: any) => assignment.id) } },
      });
    }

    await this.auditRbacAction('RBAC_REVOKE_ROLE', 'success', context, {
      targetUserId: userId,
      roleId: role.id,
      roleKey: role.key,
      tenantId,
      module,
      revoked: assignments.length,
    }, 'role', role.id);

    return {
      userId,
      role: mapRole({ ...role, permissions: [] }),
      tenantId,
      module,
      revoked: assignments.length,
    };
  }

  async auditAuthorizationFailure(context: RbacActionContext, permission: string, scope = 'rbac_admin', action = 'AUTHORIZATION_FAILED') {
    await this.auditRbacAction(action, 'failure', context, {
      permission: safeString(permission, 120),
    }, 'permission', permission, scope);
  }

  private async resolveRole(input: Pick<RoleMutationInput, 'roleId' | 'roleKey'>) {
    const roleId = normalizeNullableString(input.roleId);
    const roleKey = normalizeNullableString(input.roleKey);

    if (!roleId && !roleKey) {
      throw new Error('roleId ou roleKey e obrigatorio.');
    }

    const role = await this.client.role.findFirst({
      where: compact({
        id: roleId,
        key: roleKey,
        active: true,
      }),
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });

    if (!role) {
      throw new Error('Role ativa nao encontrada.');
    }

    return role;
  }

  private async auditRbacAction(
    action: string,
    outcome: string,
    context: RbacActionContext,
    metadata: Record<string, unknown>,
    entityType?: string,
    entityId?: string | null,
    auditScope = 'rbac_admin',
  ) {
    await this.client.auditEvent.create({
      data: {
        userId: context.user?.id ?? null,
        scope: auditScope,
        action,
        outcome,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
        requestId: normalizeHeader(context.requestId),
        ipHash: context.ip ? hashAuditValue(context.ip) : null,
        userAgentHash: normalizeHeader(context.userAgent) ? hashAuditValue(normalizeHeader(context.userAgent) as string) : null,
        emailHash: context.user?.email ? hashAuditValue(context.user.email) : null,
        metadata: sanitizeMetadataObject({
          actorRole: context.user?.role ?? null,
          tenantId: normalizeNullableString(context.tenantId, 120),
          ...metadata,
        }) as any,
      }
    });
  }
}

function activeAssignmentWhere() {
  return {
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: new Date() } },
    ],
  };
}

function tenantAssignmentWhere(tenantId?: string | null) {
  const normalizedTenantId = normalizeNullableString(tenantId);
  if (!normalizedTenantId) return { tenantId: null };
  return { OR: [{ tenantId: null }, { tenantId: normalizedTenantId }] };
}

function tenantRoleWhere(tenantId?: string | null) {
  const normalizedTenantId = normalizeNullableString(tenantId);
  if (!normalizedTenantId) return { tenantId: null };
  return { OR: [{ tenantId: null }, { tenantId: normalizedTenantId }] };
}

function mapRole(role: any) {
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description ?? null,
    scope: role.scope,
    tenantId: role.tenantId ?? null,
    module: role.module ?? null,
    system: Boolean(role.system),
    active: Boolean(role.active),
    metadata: sanitizeMetadata(role.metadata),
    permissions: (role.permissions ?? [])
      .map((entry: any) => entry.permission ? mapPermission(entry.permission) : null)
      .filter(Boolean),
    createdAt: toIso(role.createdAt),
    updatedAt: toIso(role.updatedAt),
  };
}

function mapPermission(permission: any) {
  return {
    id: permission.id,
    key: permission.key,
    module: permission.module,
    action: permission.action,
    scope: permission.scope,
    description: permission.description ?? null,
    system: Boolean(permission.system),
    metadata: sanitizeMetadata(permission.metadata),
    createdAt: toIso(permission.createdAt),
    updatedAt: toIso(permission.updatedAt),
  };
}

function paginate<T>(rows: T[], pagination: { limit: number; offset: number }) {
  const hasMore = rows.length > pagination.limit;
  return {
    data: rows.slice(0, pagination.limit),
    pagination: {
      limit: pagination.limit,
      offset: pagination.offset,
      nextOffset: hasMore ? pagination.offset + pagination.limit : null,
      hasMore,
    },
  };
}

function normalizePagination(input: PaginationInput) {
  const limit = Math.max(1, Math.min(numberValue(input.limit) ?? DEFAULT_LIMIT, MAX_LIMIT));
  const offset = Math.max(0, numberValue(input.offset) ?? 0);
  return { limit, offset };
}

function normalizePermissionKeys(permissionKeys: string[]) {
  return [...new Set(permissionKeys.map((permissionKey) => safeString(permissionKey, 120)).filter(Boolean) as string[])];
}

function normalizeScope(scope: unknown): Scope {
  const normalized = safeString(scope, 30) ?? 'global';
  if (!VALID_SCOPES.has(normalized)) {
    throw new Error('Escopo de role invalido.');
  }
  return normalized as Scope;
}

function requiredKey(value: unknown, field: string) {
  const normalized = safeString(value, 120);
  if (!normalized || !/^[a-z0-9:_-]+$/i.test(normalized)) {
    throw new Error(`${field} invalido.`);
  }
  return normalized;
}

function requiredString(value: unknown, field: string, max = 120) {
  const normalized = safeString(value, max);
  if (!normalized) {
    throw new Error(`${field} e obrigatorio.`);
  }
  return normalized;
}

function safeString(value: unknown, max = 120) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;
}

function normalizeNullableString(value: unknown, max = 120) {
  return safeString(value, max) ?? null;
}

function normalizeDate(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function booleanValue(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string' || !value.trim()) return undefined;
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  return undefined;
}

function compact<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== null));
}

function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null;
  if (depth > 4) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeMetadata(item, depth + 1));
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value.slice(0, 500);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value !== 'object') return String(value).slice(0, 500);

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .slice(0, 80)
      .map(([key, entryValue]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : sanitizeMetadata(entryValue, depth + 1),
      ]),
  );
}

function sanitizeMetadataObject(value: Record<string, unknown>) {
  const sanitized = sanitizeMetadata(value);
  if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) return {};
  return sanitized as Record<string, unknown>;
}

function normalizeHeader(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value?.trim() || null;
}

function hashAuditValue(value: string) {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function toIso(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
