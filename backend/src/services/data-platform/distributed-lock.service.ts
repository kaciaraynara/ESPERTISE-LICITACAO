import { createHash } from 'crypto';
import { prisma } from '../../database/prisma';
import { DataPlatformRepository } from './repository.service';
import { DataPlatformLock, DataPlatformRunLock, dataPlatformLog } from './worker-runtime';

interface LockEventWriter {
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

interface DistributedLockEnv {
  NODE_ENV?: string;
  DATA_PLATFORM_DISTRIBUTED_LOCK_ENABLED?: string;
  DATA_PLATFORM_DISTRIBUTED_LOCK_TIMEOUT_MS?: string;
  DATA_PLATFORM_DISTRIBUTED_LOCK_MAX_WAIT_MS?: string;
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_MAX_WAIT_MS = 10_000;

export class DataPlatformDistributedLock implements DataPlatformLock {
  constructor(
    private readonly client: any = prisma as any,
    private readonly events: LockEventWriter = new DataPlatformRepository(client),
    private readonly fallback: DataPlatformLock = new DataPlatformRunLock(),
    private readonly env: DistributedLockEnv = process.env,
  ) {}

  isLocked(key: string) {
    if (!this.isTestEnvironment()) return false;
    return this.fallback.isLocked?.(normalizeLockKey(key)) ?? false;
  }

  async runExclusive<T>(key: string, run: () => Promise<T>): Promise<{ acquired: false } | { acquired: true; value: T }> {
    const normalizedKey = normalizeLockKey(key);

    if (this.isTestEnvironment()) {
      return this.runTestLock(normalizedKey, run);
    }

    if (!this.isPostgresLockEnabled()) {
      const error = new Error('DATA_PLATFORM_DISTRIBUTED_LOCK_DISABLED');
      dataPlatformLog('error', 'DATA_PLATFORM_DISTRIBUTED_LOCK_DISABLED', {
        key: normalizedKey,
        reason: 'distributed_lock_required_outside_test',
      });
      throw error;
    }

    try {
      return await this.client.$transaction(
        async (tx: any) => {
          const lockId = advisoryLockId(normalizedKey);
          const rows = await tx.$queryRaw<{ locked: boolean }[]>`
            SELECT pg_try_advisory_xact_lock(${lockId}) AS locked
          `;
          const acquired = Boolean(rows?.[0]?.locked);

          if (!acquired) {
            await this.recordLockEvent(normalizedKey, 'lock skipped', 'warn', {
              lockId: lockId.toString(),
              reason: 'already_locked',
            });
            dataPlatformLog('warn', 'DATA_PLATFORM_DISTRIBUTED_LOCK_SKIPPED', { key: normalizedKey, lockId: lockId.toString() });
            return { acquired: false as const };
          }

          await this.recordLockEvent(normalizedKey, 'lock acquired', 'info', { lockId: lockId.toString() });
          dataPlatformLog('info', 'DATA_PLATFORM_DISTRIBUTED_LOCK_ACQUIRED', { key: normalizedKey, lockId: lockId.toString() });
          return { acquired: true as const, value: await run() };
        },
        {
          maxWait: envNumber(this.env.DATA_PLATFORM_DISTRIBUTED_LOCK_MAX_WAIT_MS, DEFAULT_MAX_WAIT_MS),
          timeout: envNumber(this.env.DATA_PLATFORM_DISTRIBUTED_LOCK_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
        },
      );
    } catch (error) {
      dataPlatformLog('error', 'DATA_PLATFORM_DISTRIBUTED_LOCK_FAILED', {
        key: normalizedKey,
        error: errorMessage(error),
      });
      throw error;
    }
  }

  private async runTestLock<T>(
    key: string,
    run: () => Promise<T>,
  ): Promise<{ acquired: false } | { acquired: true; value: T }> {
    const result = await this.fallback.runExclusive(key, run);
    if (result.acquired) {
      await this.recordLockEvent(key, 'lock acquired', 'info', {
        mode: 'memory_test_lock',
        reason: 'test_environment',
      });
    } else {
      await this.recordLockEvent(key, 'lock skipped', 'warn', {
        mode: 'memory_test_lock',
        reason: 'already_locked',
      });
    }
    return result;
  }

  private isTestEnvironment() {
    return this.env.NODE_ENV === 'test';
  }

  private isPostgresLockEnabled() {
    const value = this.env.DATA_PLATFORM_DISTRIBUTED_LOCK_ENABLED;
    if (value === undefined || value === '') return true;
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
  }

  private async recordLockEvent(key: string, message: 'lock acquired' | 'lock skipped', level: 'info' | 'warn', metadata: Record<string, unknown>) {
    try {
      await this.events.recordPipelineEvent({
        source: 'data_platform',
        stage: 'lock',
        level,
        message,
        metadata: {
          key,
          ...metadata,
        },
      });
    } catch (error) {
      dataPlatformLog('warn', 'DATA_PLATFORM_DISTRIBUTED_LOCK_EVENT_FAILED', { key, error: errorMessage(error) });
    }
  }
}

export function normalizeLockKey(key: string) {
  const trimmed = key.trim();
  return trimmed.startsWith('data-platform:') ? trimmed : `data-platform:${trimmed || 'default'}`;
}

export function advisoryLockId(key: string) {
  const hash = createHash('sha256').update(key).digest();
  const value = hash.readBigUInt64BE(0) & ((1n << 63n) - 1n);
  return value === 0n ? 1n : value;
}

function envNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
