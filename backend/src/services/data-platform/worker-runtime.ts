export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  sleep?: (delayMs: number) => Promise<void>;
  onRetry?: (input: { attempt: number; nextAttempt: number; delayMs: number; error: unknown }) => void;
}

export interface DataPlatformLock {
  isLocked?(key: string): boolean;
  runExclusive<T>(key: string, run: () => Promise<T>): Promise<{ acquired: false } | { acquired: true; value: T }>;
}

export class DataPlatformRunLock implements DataPlatformLock {
  private readonly activeKeys = new Set<string>();

  isLocked(key: string) {
    return this.activeKeys.has(key);
  }

  async runExclusive<T>(key: string, run: () => Promise<T>): Promise<{ acquired: false } | { acquired: true; value: T }> {
    if (this.activeKeys.has(key)) {
      return { acquired: false };
    }

    this.activeKeys.add(key);
    try {
      return { acquired: true, value: await run() };
    } finally {
      this.activeKeys.delete(key);
    }
  }
}

export async function withRetry<T>(run: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 1000);
  const sleep = options.sleep ?? delay;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      return await run();
    } catch (error) {
      if (attempt >= maxAttempts) {
        throw error;
      }

      const delayMs = baseDelayMs * 2 ** (attempt - 1);
      options.onRetry?.({ attempt, nextAttempt: attempt + 1, delayMs, error });
      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }
  }

  throw new Error('Retry loop exhausted unexpectedly.');
}

export function dataPlatformLog(level: 'info' | 'warn' | 'error', event: string, payload: Record<string, unknown> = {}) {
  const message = JSON.stringify({
    event,
    scope: 'data_platform',
    timestamp: new Date().toISOString(),
    ...payload,
  });

  if (level === 'error') {
    console.error(message);
  } else if (level === 'warn') {
    console.warn(message);
  } else {
    console.log(message);
  }
}

function delay(delayMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}
