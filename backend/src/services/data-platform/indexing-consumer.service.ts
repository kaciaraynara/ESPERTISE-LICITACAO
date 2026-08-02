import { randomUUID } from 'crypto';
import { prisma } from '../../database/prisma';
import { DataPlatformDistributedLock } from './distributed-lock.service';
import { DataPlatformRepository } from './repository.service';
import { DataPlatformLock, dataPlatformLog, withRetry } from './worker-runtime';

export interface SearchIndexTaskRecord {
  id: string;
  tenantId?: string | null;
  targetType: string;
  targetId: string;
  engine: string;
  operation: string;
  status: string;
  attempts: number;
  lastError?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface VectorIndexProvider {
  isConfigured(): boolean;
  process(task: SearchIndexTaskRecord): Promise<Record<string, unknown> | void>;
}

export interface SearchEngineAdapter {
  isConfigured(): boolean;
  process(task: SearchIndexTaskRecord): Promise<Record<string, unknown> | void>;
}

interface SearchIndexTaskConsumerOptions {
  batchSize?: number;
  maxAttempts?: number;
  retryBaseDelayMs?: number;
  tenantId?: string | null;
  engine?: string;
  traceId?: string | null;
  sleep?: (delayMs: number) => Promise<void>;
}

interface RequeueSearchIndexTaskOptions {
  engine?: string;
  reason?: string;
  olderThanMinutes?: number;
  maxAttempts?: number;
  limit?: number;
  tenantId?: string | null;
  traceId?: string | null;
}

interface PipelineEventWriter {
  recordPipelineEvent(input: {
    jobId?: string | null;
    tenantId?: string | null;
    traceId?: string | null;
    source: string;
    stage: string;
    level?: 'info' | 'warn' | 'error';
    message: string;
    durationMs?: number | null;
    counters?: Record<string, number> | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<unknown>;
}

type TaskOutcome =
  | { status: 'completed'; reason?: string; metadata?: Record<string, unknown> }
  | { status: 'skipped'; reason: string; metadata?: Record<string, unknown> }
  | { status: 'failed'; reason: string; metadata?: Record<string, unknown> };

const PENDING_STATUSES = ['pending', 'queued'];
const TERMINAL_CLEANUP_STATUSES = ['completed', 'skipped'];
const PERMANENT_FAILURE_PREFIXES = ['unsupported_engine:', 'permanent_error:', 'validation_error:'];

export class SearchIndexTaskConsumer {
  constructor(
    private readonly client: any = prisma as any,
    private readonly events: PipelineEventWriter = new DataPlatformRepository(client),
    private readonly providers: {
      vector?: VectorIndexProvider | null;
      opensearch?: SearchEngineAdapter | null;
      elasticsearch?: SearchEngineAdapter | null;
    } = {},
    private readonly lock: DataPlatformLock = new DataPlatformDistributedLock(client, events),
  ) {}

  async consumePending(input: SearchIndexTaskConsumerOptions = {}) {
    const lockKey = `search-index:${input.tenantId ?? 'global'}:${input.engine ?? 'all'}`;
    const locked = await this.lock.runExclusive(lockKey, () => this.consumePendingUnlocked(input));

    if (!locked.acquired) {
      dataPlatformLog('warn', 'SEARCH_INDEX_CONSUMER_SKIPPED_LOCKED', { lockKey });
      return {
        status: 'skipped' as const,
        reason: 'locked',
        counters: emptyCounters(),
      };
    }

    return locked.value;
  }

  async cleanupOldTasks(input: { olderThanDays?: number; tenantId?: string | null } = {}) {
    const olderThanDays = Math.max(1, input.olderThanDays ?? 30);
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const deleted = await this.client.searchIndexTask.deleteMany({
      where: {
        status: { in: TERMINAL_CLEANUP_STATUSES },
        updatedAt: { lt: cutoff },
        ...(input.tenantId === undefined ? {} : { tenantId: input.tenantId }),
      },
    });

    const count = Number(deleted?.count ?? 0);
    dataPlatformLog('info', 'SEARCH_INDEX_TASK_CLEANUP_COMPLETED', { count, olderThanDays });
    await this.events.recordPipelineEvent({
      source: 'data_platform',
      stage: 'indexing',
      message: 'Limpeza de tarefas antigas de indexacao concluida',
      counters: { deleted: count },
      metadata: { olderThanDays, cutoff: cutoff.toISOString() },
    });

    return { deleted: count, cutoff };
  }

  requeueSkippedTasks(input: RequeueSearchIndexTaskOptions = {}) {
    return this.requeueTasks('skipped', input);
  }

  requeueFailedTasks(input: RequeueSearchIndexTaskOptions = {}) {
    return this.requeueTasks('failed', input);
  }

  private async consumePendingUnlocked(input: SearchIndexTaskConsumerOptions) {
    const startedAt = Date.now();
    const traceId = input.traceId ?? randomUUID();
    const batchSize = Math.max(1, Math.min(input.batchSize ?? envNumber('DATA_PLATFORM_INDEX_BATCH_SIZE', 25), 100));
    const maxAttempts = Math.max(1, input.maxAttempts ?? envNumber('DATA_PLATFORM_INDEX_MAX_ATTEMPTS', 3));
    const retryBaseDelayMs = Math.max(0, input.retryBaseDelayMs ?? envNumber('DATA_PLATFORM_INDEX_RETRY_BASE_MS', 1000));
    const counters = emptyCounters();

    const tasks: SearchIndexTaskRecord[] = await this.client.searchIndexTask.findMany({
      where: {
        status: { in: PENDING_STATUSES },
        attempts: { lt: maxAttempts },
        ...(input.engine ? { engine: input.engine } : {}),
        ...(input.tenantId === undefined ? {} : { tenantId: input.tenantId }),
      },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
    });

    counters.seen = tasks.length;
    await this.events.recordPipelineEvent({
      source: 'data_platform',
      traceId,
      stage: 'indexing',
      message: 'Consumo de tarefas de indexacao iniciado',
      counters: { seen: tasks.length },
      metadata: { batchSize, engine: input.engine ?? null },
    });

    for (const task of tasks) {
      const claimed = await this.claimTask(task);
      if (!claimed) {
        counters.skipped += 1;
        continue;
      }

      counters.running += 1;
      const outcome = await this.processTaskWithRetry(task, { maxAttempts, retryBaseDelayMs, sleep: input.sleep });
      await this.finishTask(task, outcome, traceId);
      counters[outcome.status] += 1;
    }

    dataPlatformLog('info', 'SEARCH_INDEX_CONSUMER_COMPLETED', {
      traceId,
      durationMs: Date.now() - startedAt,
      counters,
    });
    await this.events.recordPipelineEvent({
      source: 'data_platform',
      traceId,
      stage: 'indexing',
      message: 'Consumo de tarefas de indexacao concluido',
      durationMs: Date.now() - startedAt,
      counters,
    });

    return {
      status: 'completed' as const,
      traceId,
      counters,
    };
  }

  private async requeueTasks(status: 'skipped' | 'failed', input: RequeueSearchIndexTaskOptions) {
    const lockKey = `search-index:requeue:${status}:${input.tenantId ?? 'global'}:${input.engine ?? 'all'}:${input.reason ?? 'any'}`;
    const locked = await this.lock.runExclusive(lockKey, () => this.requeueTasksUnlocked(status, input));

    if (!locked.acquired) {
      dataPlatformLog('warn', 'SEARCH_INDEX_REQUEUE_SKIPPED_LOCKED', { lockKey });
      return {
        status: 'skipped' as const,
        reason: 'locked',
        counters: requeueCounters(),
      };
    }

    return locked.value;
  }

  private async requeueTasksUnlocked(status: 'skipped' | 'failed', input: RequeueSearchIndexTaskOptions) {
    const startedAt = Date.now();
    const traceId = input.traceId ?? randomUUID();
    const maxAttempts = Math.max(1, input.maxAttempts ?? envNumber('DATA_PLATFORM_INDEX_MAX_ATTEMPTS', 3));
    const limit = Math.max(1, Math.min(input.limit ?? 50, 500));
    const olderThanMinutes = Math.max(0, input.olderThanMinutes ?? 0);
    const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    const counters = requeueCounters();

    await this.events.recordPipelineEvent({
      source: 'data_platform',
      traceId,
      stage: 'requeue',
      message: 'requeue started',
      metadata: { status, engine: input.engine ?? null, reason: input.reason ?? null, maxAttempts, limit, olderThanMinutes },
    });

    try {
      const candidates: SearchIndexTaskRecord[] = await this.client.searchIndexTask.findMany({
        where: {
          status,
          attempts: { lt: maxAttempts },
          updatedAt: { lte: cutoff },
          ...(input.engine ? { engine: input.engine } : {}),
          ...(input.tenantId === undefined ? {} : { tenantId: input.tenantId }),
        },
        orderBy: { updatedAt: 'asc' },
        take: limit * 3,
      });

      counters.seen = candidates.length;
      const selected = candidates
        .filter((task) => task.attempts < maxAttempts)
        .filter((task) => !input.reason || taskReason(task) === input.reason)
        .filter((task) => status !== 'failed' || !isPermanentFailure(task))
        .slice(0, limit);

      counters.eligible = selected.length;

      for (const task of selected) {
        await this.client.searchIndexTask.update({
          where: { id: task.id },
          data: {
            status: 'pending',
            lastError: null,
            metadata: mergeMetadata(task.metadata, {
              requeue: {
                previousStatus: task.status,
                reason: taskReason(task),
                traceId,
                requeuedAt: new Date().toISOString(),
                attemptsPreserved: task.attempts,
              },
            }),
          },
        });
        counters.requeued += 1;
      }

      counters.blocked = counters.seen - counters.requeued;
      dataPlatformLog('info', 'SEARCH_INDEX_REQUEUE_COMPLETED', { traceId, status, counters });
      await this.events.recordPipelineEvent({
        source: 'data_platform',
        traceId,
        stage: 'requeue',
        message: 'requeue completed',
        durationMs: Date.now() - startedAt,
        counters,
        metadata: { status, engine: input.engine ?? null, reason: input.reason ?? null, maxAttempts, limit },
      });

      return {
        status: 'completed' as const,
        traceId,
        counters,
      };
    } catch (error) {
      dataPlatformLog('error', 'SEARCH_INDEX_REQUEUE_FAILED', { traceId, status, error: errorMessage(error) });
      await this.events.recordPipelineEvent({
        source: 'data_platform',
        traceId,
        stage: 'requeue',
        level: 'error',
        message: 'requeue failed',
        durationMs: Date.now() - startedAt,
        metadata: { status, error: errorMessage(error) },
      });
      throw error;
    }
  }

  private async claimTask(task: SearchIndexTaskRecord) {
    const claimed = await this.client.searchIndexTask.updateMany({
      where: {
        id: task.id,
        status: { in: PENDING_STATUSES },
      },
      data: {
        status: 'running',
        attempts: { increment: 1 },
        lastError: null,
        metadata: mergeMetadata(task.metadata, {
          worker: {
            status: 'running',
            startedAt: new Date().toISOString(),
          },
        }),
      },
    });

    return Number(claimed?.count ?? 0) > 0;
  }

  private async processTaskWithRetry(
    task: SearchIndexTaskRecord,
    input: { maxAttempts: number; retryBaseDelayMs: number; sleep?: (delayMs: number) => Promise<void> },
  ): Promise<TaskOutcome> {
    try {
      return await withRetry(() => this.processTask(task), {
        maxAttempts: input.maxAttempts,
        baseDelayMs: input.retryBaseDelayMs,
        sleep: input.sleep,
        onRetry: ({ attempt, nextAttempt, delayMs, error }) => {
          dataPlatformLog('warn', 'SEARCH_INDEX_TASK_RETRY', {
            taskId: task.id,
            engine: task.engine,
            attempt,
            nextAttempt,
            delayMs,
            error: errorMessage(error),
          });
        },
      });
    } catch (error) {
      return {
        status: 'failed',
        reason: errorMessage(error),
      };
    }
  }

  private async processTask(task: SearchIndexTaskRecord): Promise<TaskOutcome> {
    if (task.engine === 'pgvector') {
      const provider = this.providers.vector;
      if (!provider?.isConfigured()) {
        return {
          status: 'skipped',
          reason: 'pending_external_provider',
          metadata: { provider: 'pgvector' },
        };
      }

      const metadata = await provider.process(task);
      return { status: 'completed', metadata: metadata ?? undefined };
    }

    if (task.engine === 'opensearch' || task.engine === 'elasticsearch') {
      const engine = task.engine === 'opensearch' ? this.providers.opensearch : this.providers.elasticsearch;
      if (!engine?.isConfigured()) {
        return {
          status: 'skipped',
          reason: 'pending_external_engine',
          metadata: { engine: task.engine },
        };
      }

      const metadata = await engine.process(task);
      return { status: 'completed', metadata: metadata ?? undefined };
    }

    return {
      status: 'failed',
      reason: `unsupported_engine:${task.engine}`,
    };
  }

  private async finishTask(task: SearchIndexTaskRecord, outcome: TaskOutcome, traceId: string) {
    await this.client.searchIndexTask.update({
      where: { id: task.id },
      data: {
        status: outcome.status,
        lastError: outcome.status === 'failed' ? outcome.reason : null,
        metadata: mergeMetadata(task.metadata, {
          worker: {
            status: outcome.status,
            reason: outcome.reason ?? null,
            traceId,
            finishedAt: new Date().toISOString(),
            metadata: outcome.metadata ?? null,
          },
        }),
      },
    });

    await this.events.recordPipelineEvent({
      source: eventSource(task),
      tenantId: task.tenantId ?? null,
      traceId,
      stage: 'indexing',
      level: outcome.status === 'failed' ? 'error' : outcome.status === 'skipped' ? 'warn' : 'info',
      message: `Tarefa de indexacao ${outcome.status}`,
      counters: { [outcome.status]: 1 },
      metadata: {
        taskId: task.id,
        engine: task.engine,
        operation: task.operation,
        reason: outcome.reason ?? null,
      },
    });
  }
}

function emptyCounters() {
  return {
    seen: 0,
    running: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
  };
}

function requeueCounters() {
  return {
    seen: 0,
    eligible: 0,
    requeued: 0,
    blocked: 0,
  };
}

function mergeMetadata(metadata: SearchIndexTaskRecord['metadata'], patch: Record<string, unknown>) {
  return {
    ...(metadata && typeof metadata === 'object' ? metadata : {}),
    ...patch,
  };
}

function eventSource(task: SearchIndexTaskRecord) {
  const source = task.metadata?.source;
  return typeof source === 'string' && source.trim() ? source.trim() : 'data_platform';
}

function taskReason(task: SearchIndexTaskRecord) {
  const worker = task.metadata?.worker;
  if (worker && typeof worker === 'object' && 'reason' in worker) {
    const reason = (worker as { reason?: unknown }).reason;
    if (typeof reason === 'string' && reason.trim()) return reason.trim();
  }

  return task.lastError || null;
}

function isPermanentFailure(task: SearchIndexTaskRecord) {
  const reason = taskReason(task);
  return typeof reason === 'string' && PERMANENT_FAILURE_PREFIXES.some((prefix) => reason.startsWith(prefix));
}

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
