import { prisma } from '../database/prisma';

interface PaginationInput {
  limit?: number;
  offset?: number;
}

interface PeriodInput {
  from?: string | Date | null;
  to?: string | Date | null;
}

interface ListAuditEventsInput extends PaginationInput, PeriodInput {
  scope?: string;
  action?: string;
  outcome?: string;
  userId?: string;
  entity?: string;
}

interface AuditMetricsInput extends PeriodInput {
  scope?: string;
}

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const METRICS_EVENTS_LIMIT = 5000;
const SENSITIVE_KEY_PATTERN = /(password|senha|token|secret|authorization|cookie|api[_-]?key|rawpayload|payload|cpf|cnpj|email|ip|useragent|user_agent|ua|session|refresh)/i;

export class AuditAdminService {
  constructor(private readonly client: any = prisma as any) {}

  async listEvents(input: ListAuditEventsInput = {}) {
    const pagination = normalizePagination(input);
    const rows = await this.client.auditEvent.findMany({
      where: buildAuditWhere(input),
      orderBy: { createdAt: 'desc' },
      skip: pagination.offset,
      take: pagination.limit + 1,
      select: auditEventSelect(),
    });

    return paginate(rows.map(mapAuditEvent), pagination);
  }

  async getMetrics(input: AuditMetricsInput = {}) {
    const where = buildAuditWhere(input);
    const authorizationFailuresWhere = {
      ...where,
      action: 'AUTHORIZATION_FAILED',
      outcome: 'failure',
    };
    const [eventsByScope, eventsByOutcome, recentAdminActions, authorizationFailuresCount, authorizationFailures, periodEvents] = await Promise.all([
      this.client.auditEvent.groupBy({
        by: ['scope'],
        where,
        _count: { _all: true },
      }),
      this.client.auditEvent.groupBy({
        by: ['outcome'],
        where,
        _count: { _all: true },
      }),
      this.client.auditEvent.findMany({
        where: {
          ...where,
          scope: input.scope ? safeString(input.scope) : { contains: 'admin' },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: auditEventSelect(),
      }),
      this.client.auditEvent.count({
        where: authorizationFailuresWhere,
      }),
      this.client.auditEvent.findMany({
        where: authorizationFailuresWhere,
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: auditEventSelect(),
      }),
      this.client.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        take: METRICS_EVENTS_LIMIT,
        select: { createdAt: true },
      }),
    ]);

    return {
      eventsByScope: eventsByScope.map((row: any) => ({
        scope: row.scope,
        count: row._count?._all ?? 0,
      })),
      eventsByOutcome: eventsByOutcome.map((row: any) => ({
        outcome: row.outcome,
        count: row._count?._all ?? 0,
      })),
      recentAdminActions: recentAdminActions.map(mapAuditEvent),
      authorizationFailures: {
        count: authorizationFailuresCount,
        recent: authorizationFailures.map(mapAuditEvent),
      },
      eventsByPeriod: groupEventsByDay(periodEvents),
    };
  }
}

function auditEventSelect() {
  return {
    id: true,
    userId: true,
    scope: true,
    action: true,
    outcome: true,
    entityType: true,
    entityId: true,
    requestId: true,
    metadata: true,
    createdAt: true,
  };
}

function buildAuditWhere(input: ListAuditEventsInput | AuditMetricsInput) {
  const entity = safeString((input as ListAuditEventsInput).entity);
  const where = compact({
    scope: safeString(input.scope),
    action: safeString((input as ListAuditEventsInput).action),
    outcome: safeString((input as ListAuditEventsInput).outcome),
    userId: safeString((input as ListAuditEventsInput).userId),
    createdAt: periodWhere(input),
  });

  if (entity) {
    where.OR = [{ entityType: entity }, { entityId: entity }];
  }

  return where;
}

function mapAuditEvent(row: any) {
  return {
    id: row.id,
    userId: row.userId ?? null,
    scope: row.scope,
    action: row.action,
    outcome: row.outcome,
    entityType: row.entityType ?? null,
    entityId: row.entityId ?? null,
    requestId: row.requestId ?? null,
    metadata: sanitizeMetadata(row.metadata),
    createdAt: toIso(row.createdAt),
  };
}

function groupEventsByDay(rows: Array<{ createdAt: Date | string }>) {
  const grouped = new Map<string, number>();
  for (const row of rows) {
    const day = toIso(row.createdAt)?.slice(0, 10);
    if (!day) continue;
    grouped.set(day, (grouped.get(day) ?? 0) + 1);
  }
  return [...grouped.entries()].map(([period, count]) => ({ period, count }));
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

function periodWhere(input: PeriodInput) {
  const gte = dateValue(input.from);
  const lte = dateValue(input.to);
  if (!gte && !lte) return undefined;
  return compact({ gte, lte });
}

function compact<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

function safeString(value: unknown, max = 120) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;
}

function dateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function sanitizeAuditMetadata(value: unknown, depth = 0): unknown {
  return sanitizeMetadata(value, depth);
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

function toIso(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
