import cron from 'node-cron';
import { DataFetchInput } from './types';
import { DataPlatformIngestionService } from './ingestion.service';
import { SearchIndexTaskConsumer } from './indexing-consumer.service';
import { DataPlatformDistributedLock } from './distributed-lock.service';
import { DataPlatformLock, dataPlatformLog, withRetry } from './worker-runtime';
import { TcuIngestionService } from './tcu-ingestion.service';

interface WorkerEnv {
  [key: string]: string | undefined;
  NODE_ENV?: string;
  DATA_PLATFORM_WORKERS_ENABLED?: string;
  DATA_PLATFORM_INGESTION_WORKER_ENABLED?: string;
  DATA_PLATFORM_INDEX_WORKER_ENABLED?: string;
  DATA_PLATFORM_PNCP_WORKER_ENABLED?: string;
  DATA_PLATFORM_COMPRASGOV_WORKER_ENABLED?: string;
  DATA_PLATFORM_TCU_WORKER_ENABLED?: string;
  DATA_PLATFORM_PNCP_CRON?: string;
  DATA_PLATFORM_COMPRASGOV_CRON?: string;
  DATA_PLATFORM_TCU_CRON?: string;
  DATA_PLATFORM_INDEX_CRON?: string;
  DATA_PLATFORM_WORKER_TIMEZONE?: string;
  DATA_PLATFORM_WORKER_MAX_ATTEMPTS?: string;
  DATA_PLATFORM_WORKER_RETRY_BASE_MS?: string;
  DATA_PLATFORM_PNCP_LIMIT?: string;
  DATA_PLATFORM_COMPRASGOV_LIMIT?: string;
  DATA_PLATFORM_TCU_LIMIT?: string;
  DATA_PLATFORM_PNCP_FILTERS?: string;
  DATA_PLATFORM_COMPRASGOV_FILTERS?: string;
}

interface CronScheduler {
  validate(expression: string): boolean;
  schedule(expression: string, task: () => void | Promise<void>, options?: Record<string, unknown>): { stop(): void };
}

type ManualRunResult<T> =
  | { status: 'completed'; result: T }
  | { status: 'skipped'; reason: 'locked' }
  | { status: 'failed'; error: string };

const DEFAULT_PNCP_CRON = '*/30 * * * *';
const DEFAULT_COMPRASGOV_CRON = '10,40 * * * *';
const DEFAULT_TCU_CRON = '0 3 * * 0'; // Sunday at 3 AM
const DEFAULT_INDEX_CRON = '*/5 * * * *';
const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

export class DataPlatformWorkerService {
  private scheduledTasks: Array<{ stop(): void }> = [];

  constructor(
    private readonly ingestion = new DataPlatformIngestionService(),
    private readonly tcuIngestion = new TcuIngestionService(),
    private readonly indexConsumer = new SearchIndexTaskConsumer(),
    private readonly lock: DataPlatformLock = new DataPlatformDistributedLock(),
    private readonly scheduler: CronScheduler = cron,
    private readonly env: WorkerEnv = process.env,
  ) {}

  start() {
    if (!this.isSchedulingEnabled()) {
      dataPlatformLog('info', 'DATA_PLATFORM_WORKERS_DISABLED', {
        nodeEnv: this.env.NODE_ENV,
        workersEnabled: this.env.DATA_PLATFORM_WORKERS_ENABLED ?? null,
      });
      return [];
    }

    const timezone = this.env.DATA_PLATFORM_WORKER_TIMEZONE || DEFAULT_TIMEZONE;
    const scheduled: Array<{ name: string; cron: string }> = [];

    if (this.isEnabled('DATA_PLATFORM_INGESTION_WORKER_ENABLED', true) && this.isEnabled('DATA_PLATFORM_PNCP_WORKER_ENABLED', true)) {
      scheduled.push(this.schedule('pncp-ingestion', this.env.DATA_PLATFORM_PNCP_CRON || DEFAULT_PNCP_CRON, timezone, () => this.runPncpIngestion()));
    }

    if (this.isEnabled('DATA_PLATFORM_INGESTION_WORKER_ENABLED', true) && this.isEnabled('DATA_PLATFORM_COMPRASGOV_WORKER_ENABLED', true)) {
      scheduled.push(this.schedule('comprasgov-ingestion', this.env.DATA_PLATFORM_COMPRASGOV_CRON || DEFAULT_COMPRASGOV_CRON, timezone, () => this.runComprasGovIngestion()));
    }

    if (this.isEnabled('DATA_PLATFORM_INGESTION_WORKER_ENABLED', true) && this.isEnabled('DATA_PLATFORM_TCU_WORKER_ENABLED', true)) {
      scheduled.push(this.schedule('tcu-ingestion', this.env.DATA_PLATFORM_TCU_CRON || DEFAULT_TCU_CRON, timezone, () => this.runTcuIngestion()));
    }

    if (this.isEnabled('DATA_PLATFORM_INDEX_WORKER_ENABLED', true)) {
      scheduled.push(this.schedule('search-index-consumer', this.env.DATA_PLATFORM_INDEX_CRON || DEFAULT_INDEX_CRON, timezone, () => this.consumeSearchIndexTasks()));
    }

    dataPlatformLog('info', 'DATA_PLATFORM_WORKERS_CONFIGURED', { scheduled });

    void this.runInitialSynchronization();

    return scheduled;
  }

  private async runInitialSynchronization() {
    dataPlatformLog('info', 'DATA_PLATFORM_INITIAL_SYNC_STARTED');

    const [pncp, comprasGov, tcu] = await Promise.allSettled([
      this.runPncpIngestion(),
      this.runComprasGovIngestion(),
      this.runTcuIngestion(),
    ]);

    const indexing = await this.consumeSearchIndexTasks();

    dataPlatformLog('info', 'DATA_PLATFORM_INITIAL_SYNC_COMPLETED', {
      pncp: pncp.status,
      comprasGov: comprasGov.status,
      tcu: tcu.status,
      indexingStatus: indexing.status,
    });
  }

  stop() {
    for (const task of this.scheduledTasks) {
      task.stop();
    }
    const stopped = this.scheduledTasks.length;
    this.scheduledTasks = [];
    dataPlatformLog('info', 'DATA_PLATFORM_WORKERS_STOPPED', { stopped });
    return stopped;
  }

  runPncpIngestion(input: DataFetchInput = {}) {
    return this.runManual('ingestion:pncp', () => this.ingestion.ingestPncp(mergeFetchInput(defaultPncpInput(this.env), input)));
  }

  runComprasGovIngestion(input: DataFetchInput = {}) {
    return this.runManual('ingestion:compras_gov', () => this.ingestion.ingestComprasGov(mergeFetchInput(defaultComprasGovInput(this.env), input)));
  }

  runTcuIngestion(input: DataFetchInput = {}) {
    return this.runManual('ingestion:tcu', () => this.tcuIngestion.ingestTcuAcordaos(input.limit || envNumber(this.env.DATA_PLATFORM_TCU_LIMIT, 20), input.tenantId || undefined));
  }

  consumeSearchIndexTasks(input: Parameters<SearchIndexTaskConsumer['consumePending']>[0] = {}) {
    return this.runManual('indexing:search_tasks', () => this.indexConsumer.consumePending(input));
  }

  cleanupOldSearchIndexTasks(input: Parameters<SearchIndexTaskConsumer['cleanupOldTasks']>[0] = {}) {
    return this.runManual('indexing:cleanup', () => this.indexConsumer.cleanupOldTasks(input));
  }

  requeueSkippedTasks(input: Parameters<SearchIndexTaskConsumer['requeueSkippedTasks']>[0] = {}) {
    return this.requeueSkippedSearchIndexTasks(input);
  }

  requeueFailedTasks(input: Parameters<SearchIndexTaskConsumer['requeueFailedTasks']>[0] = {}) {
    return this.requeueFailedSearchIndexTasks(input);
  }

  requeueSkippedSearchIndexTasks(input: Parameters<SearchIndexTaskConsumer['requeueSkippedTasks']>[0] = {}) {
    return this.runManual('indexing:requeue:skipped', () => this.indexConsumer.requeueSkippedTasks(input));
  }

  requeueFailedSearchIndexTasks(input: Parameters<SearchIndexTaskConsumer['requeueFailedTasks']>[0] = {}) {
    return this.runManual('indexing:requeue:failed', () => this.indexConsumer.requeueFailedTasks(input));
  }

  private async runManual<T>(lockKey: string, run: () => Promise<T>): Promise<ManualRunResult<T>> {
    const locked = await this.lock.runExclusive(lockKey, async () => {
      try {
        const result = await withRetry(run, {
          maxAttempts: envNumber(this.env.DATA_PLATFORM_WORKER_MAX_ATTEMPTS, 3),
          baseDelayMs: envNumber(this.env.DATA_PLATFORM_WORKER_RETRY_BASE_MS, 1000),
          onRetry: ({ attempt, nextAttempt, delayMs, error }) => {
            dataPlatformLog('warn', 'DATA_PLATFORM_WORKER_RETRY', {
              lockKey,
              attempt,
              nextAttempt,
              delayMs,
              error: errorMessage(error),
            });
          },
        });
        return { status: 'completed' as const, result };
      } catch (error) {
        dataPlatformLog('error', 'DATA_PLATFORM_WORKER_FAILED', { lockKey, error: errorMessage(error) });
        return { status: 'failed' as const, error: errorMessage(error) };
      }
    });

    if (!locked.acquired) {
      dataPlatformLog('warn', 'DATA_PLATFORM_WORKER_SKIPPED_LOCKED', { lockKey });
      return { status: 'skipped', reason: 'locked' };
    }

    return locked.value;
  }

  private schedule(name: string, expression: string, timezone: string, run: () => Promise<unknown>) {
    if (!this.scheduler.validate(expression)) {
      throw new Error(`Cron invalido para ${name}: ${expression}`);
    }

    const task = this.scheduler.schedule(
      expression,
      async () => {
        dataPlatformLog('info', 'DATA_PLATFORM_WORKER_TICK', { name, expression });
        await run();
      },
      { timezone },
    );

    this.scheduledTasks.push(task);
    return { name, cron: expression };
  }

  private isSchedulingEnabled() {
    return this.env.NODE_ENV !== 'test' && this.isEnabled('DATA_PLATFORM_WORKERS_ENABLED', false);
  }

  private isEnabled(name: keyof WorkerEnv, defaultValue: boolean) {
    const value = this.env[name];
    if (value === undefined || value === '') return defaultValue;
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }
}

export function setupDataPlatformWorkers() {
  return new DataPlatformWorkerService().start();
}

function defaultPncpInput(env: WorkerEnv): DataFetchInput {
  return {
    limit: envNumber(env.DATA_PLATFORM_PNCP_LIMIT, 50),
    filters: parseJsonObject(env.DATA_PLATFORM_PNCP_FILTERS),
  };
}

function defaultComprasGovInput(env: WorkerEnv): DataFetchInput {
  return {
    limit: envNumber(env.DATA_PLATFORM_COMPRASGOV_LIMIT, 50),
    filters: parseJsonObject(env.DATA_PLATFORM_COMPRASGOV_FILTERS),
  };
}

function mergeFetchInput(base: DataFetchInput, override: DataFetchInput): DataFetchInput {
  return {
    ...base,
    ...override,
    filters: {
      ...(base.filters ?? {}),
      ...(override.filters ?? {}),
    },
  };
}

function parseJsonObject(raw?: string) {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    dataPlatformLog('warn', 'DATA_PLATFORM_WORKER_FILTERS_INVALID', { raw });
    return {};
  }
}

function envNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
