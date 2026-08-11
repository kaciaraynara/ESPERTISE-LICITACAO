import { createHash } from 'crypto';
import { prisma } from '../../database/prisma';
import { DataPlatformWorkerService } from './worker.service';
import type { DataFetchInput } from './types';

type AdminUser = {
  id: string;
  email?: string | null;
  role?: string | null;
};

interface AdminActionContext {
  user: AdminUser;
  requestId?: string | string[] | null;
  ip?: string | null;
  userAgent?: string | string[] | null;
}

interface PaginationInput {
  limit?: number;
  offset?: number;
}

interface PeriodInput {
  from?: string | Date | null;
  to?: string | Date | null;
}

interface ListJobsInput extends PaginationInput, PeriodInput {
  source?: string;
  status?: string;
}

interface ListEventsInput extends PaginationInput, PeriodInput {
  source?: string;
  stage?: string;
  level?: string;
}

interface ListTasksInput extends PaginationInput, PeriodInput {
  engine?: string;
  status?: string;
  attempts?: number;
  reason?: string;
}

interface RequeueInput {
  engine?: string;
  reason?: string;
  olderThanMinutes?: number;
  maxAttempts?: number;
  limit?: number;
  tenantId?: string | null;
}

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const SENSITIVE_KEY_PATTERN = /(password|senha|token|secret|authorization|cookie|api[_-]?key|rawpayload|payload|cpf|cnpj|email|ip|useragent)/i;

export class DataPlatformAdminService {
  constructor(
    private readonly client: any = prisma as any,
    private readonly worker = new DataPlatformWorkerService(),
  ) {}

  async listJobs(input: ListJobsInput = {}) {
    const pagination = normalizePagination(input);
    const rows = await this.client.dataIngestionJob.findMany({
      where: compact({
        source: safeString(input.source),
        status: safeString(input.status),
        createdAt: periodWhere(input),
      }),
      orderBy: { createdAt: 'desc' },
      skip: pagination.offset,
      take: pagination.limit + 1,
      select: {
        id: true,
        tenantId: true,
        source: true,
        connector: true,
        status: true,
        pipelineStage: true,
        requestedByUserId: true,
        startedAt: true,
        finishedAt: true,
        recordsSeen: true,
        recordsAccepted: true,
        recordsDuplicated: true,
        recordsFailed: true,
        retries: true,
        errorMessage: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return paginate(rows.map(mapJob), pagination);
  }

  async listEvents(input: ListEventsInput = {}) {
    const pagination = normalizePagination(input);
    const rows = await this.client.dataPipelineEvent.findMany({
      where: compact({
        source: safeString(input.source),
        stage: safeString(input.stage),
        level: safeString(input.level),
        createdAt: periodWhere(input),
      }),
      orderBy: { createdAt: 'desc' },
      skip: pagination.offset,
      take: pagination.limit + 1,
      select: {
        id: true,
        jobId: true,
        tenantId: true,
        traceId: true,
        source: true,
        stage: true,
        level: true,
        message: true,
        durationMs: true,
        counters: true,
        metadata: true,
        createdAt: true,
      },
    });

    return paginate(rows.map(mapEvent), pagination);
  }

  async listTasks(input: ListTasksInput = {}) {
    const pagination = normalizePagination(input);
    const where = compact({
      engine: safeString(input.engine),
      status: safeString(input.status),
      attempts: typeof input.attempts === 'number' && Number.isFinite(input.attempts) ? input.attempts : undefined,
      createdAt: periodWhere(input),
    });

    if (input.reason) {
      where.OR = [
        { lastError: input.reason },
        { metadata: { path: ['worker', 'reason'], equals: input.reason } },
      ];
    }

    const rows = await this.client.searchIndexTask.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: pagination.offset,
      take: pagination.limit + 1,
      select: {
        id: true,
        tenantId: true,
        targetType: true,
        targetId: true,
        engine: true,
        operation: true,
        status: true,
        attempts: true,
        lastError: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return paginate(rows.map(mapTask), pagination);
  }

  async listCursors(input: { source?: string } & PaginationInput = {}) {
    const pagination = normalizePagination(input);
    const rows = await this.client.dataSourceCursor.findMany({
      where: compact({ source: safeString(input.source) }),
      orderBy: [{ source: 'asc' }, { cursorKey: 'asc' }],
      skip: pagination.offset,
      take: pagination.limit + 1,
      select: {
        id: true,
        tenantId: true,
        source: true,
        cursorKey: true,
        cursorValue: true,
        lastSyncedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return paginate(rows.map(mapCursor), pagination);
  }

  async getMetrics(input: PeriodInput = {}) {
    const jobWhere = compact({ createdAt: periodWhere(input) });
    const [jobsByStatus, taskGroups, chunksCreated] = await Promise.all([
      this.client.dataIngestionJob.groupBy({
        by: ['status'],
        where: jobWhere,
        _count: { _all: true },
        _sum: {
          recordsSeen: true,
          recordsAccepted: true,
          recordsDuplicated: true,
          recordsFailed: true,
        },
      }),
      this.client.searchIndexTask.groupBy({
        by: ['engine', 'status'],
        _count: { _all: true },
      }),
      this.client.documentChunk.count(),
    ]);

    return {
      jobsByStatus: jobsByStatus.map((row: any) => ({
        status: row.status,
        count: row._count?._all ?? 0,
        recordsSeen: row._sum?.recordsSeen ?? 0,
        recordsAccepted: row._sum?.recordsAccepted ?? 0,
        recordsDuplicated: row._sum?.recordsDuplicated ?? 0,
        recordsFailed: row._sum?.recordsFailed ?? 0,
      })),
      chunksCreated,
      tasksByEngineStatus: taskGroups.map((row: any) => ({
        engine: row.engine,
        status: row.status,
        count: row._count?._all ?? 0,
      })),
    };
  }

  runPncpIngestion(input: DataFetchInput, context: AdminActionContext) {
    return this.auditManualAction('RUN_PNCP_INGESTION', context, input, () => this.worker.runPncpIngestion(input));
  }

  runComprasGovIngestion(input: DataFetchInput, context: AdminActionContext) {
    return this.auditManualAction('RUN_COMPRASGOV_INGESTION', context, input, () => this.worker.runComprasGovIngestion(input));
  }

  runTcuIngestion(input: DataFetchInput, context: AdminActionContext) {
    return this.auditManualAction('RUN_TCU_INGESTION', context, input, () => this.worker.runTcuIngestion(input));
  }

  consumeIndexTasks(input: Parameters<DataPlatformWorkerService['consumeSearchIndexTasks']>[0], context: AdminActionContext) {
    return this.auditManualAction('CONSUME_INDEX_TASKS', context, input, () => this.worker.consumeSearchIndexTasks(input));
  }

  requeueSkippedTasks(input: RequeueInput, context: AdminActionContext) {
    return this.auditManualAction('REQUEUE_SKIPPED_TASKS', context, input, () => this.worker.requeueSkippedTasks(input));
  }

  requeueFailedTasks(input: RequeueInput, context: AdminActionContext) {
    return this.auditManualAction('REQUEUE_FAILED_TASKS', context, input, () => this.worker.requeueFailedTasks(input));
  }

  cleanupOldTasks(input: Parameters<DataPlatformWorkerService['cleanupOldSearchIndexTasks']>[0], context: AdminActionContext) {
    return this.auditManualAction('CLEANUP_OLD_INDEX_TASKS', context, input, () => this.worker.cleanupOldSearchIndexTasks(input));
  }

  private async auditManualAction<T>(
    action: string,
    context: AdminActionContext,
    input: unknown,
    run: () => Promise<T>,
  ) {
    try {
      const result = await run();
      await this.addAuditEvent(action, context, 'success', { input, result: summarizeActionResult(result) });
      return result;
    } catch (error) {
      await this.addAuditEvent(action, context, 'failure', { input, error: errorMessage(error) });
      throw error;
    }
  }

  private async addAuditEvent(action: string, context: AdminActionContext, outcome: string, metadata: Record<string, unknown>) {
    await this.client.auditEvent.create({
      data: {
        scope: 'data_platform_admin',
        action,
        outcome,
        userId: context.user.id,
        requestId: normalizeHeader(context.requestId),
        ipHash: context.ip ? hashAuditValue(context.ip) : null,
        userAgentHash: normalizeHeader(context.userAgent) ? hashAuditValue(normalizeHeader(context.userAgent) as string) : null,
        emailHash: context.user.email ? hashAuditValue(context.user.email) : null,
        metadata: sanitizeMetadataObject({
          role: context.user.role ?? null,
          ...metadata,
        }) as any,
      }
    });
  }
}

function mapJob(row: any) {
  return {
    ...row,
    metadata: sanitizeMetadata(row.metadata),
  };
}

function mapEvent(row: any) {
  return {
    ...row,
    counters: sanitizeMetadata(row.counters),
    metadata: sanitizeMetadata(row.metadata),
  };
}

function mapTask(row: any) {
  return {
    ...row,
    reason: taskReason(row),
    metadata: sanitizeMetadata(row.metadata),
  };
}

function mapCursor(row: any) {
  return {
    ...row,
    cursorValue: sanitizeMetadata(row.cursorValue),
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

function periodWhere(input: PeriodInput) {
  const gte = dateValue(input.from);
  const lte = dateValue(input.to);
  if (!gte && !lte) return undefined;
  return compact({ gte, lte });
}

function compact<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

function safeString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 120) : undefined;
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

export function sanitizeMetadata(value: unknown, depth = 0): unknown {
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

function sanitizeMetadataObject(value: Record<string, unknown>): Record<string, unknown> {
  const sanitized = sanitizeMetadata(value);
  if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) {
    return {};
  }
  return sanitized as Record<string, unknown>;
}

function summarizeActionResult(value: unknown) {
  if (!value || typeof value !== 'object') return value;
  const result = value as Record<string, unknown>;
  return sanitizeMetadata({
    status: result.status,
    reason: result.reason,
    source: result.source,
    jobId: result.jobId,
    counters: result.counters,
    traceId: result.traceId,
    deleted: result.deleted,
    result: result.result && typeof result.result === 'object'
      ? {
          jobId: (result.result as Record<string, unknown>).jobId,
          source: (result.result as Record<string, unknown>).source,
          persisted: (result.result as Record<string, unknown>).persisted,
        }
      : undefined,
  });
}

function taskReason(row: any) {
  const worker = row.metadata?.worker;
  if (worker && typeof worker === 'object' && typeof worker.reason === 'string' && worker.reason.trim()) {
    return worker.reason.trim();
  }
  return row.lastError ?? null;
}

function normalizeHeader(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value?.trim() || null;
}

function hashAuditValue(value: string) {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
