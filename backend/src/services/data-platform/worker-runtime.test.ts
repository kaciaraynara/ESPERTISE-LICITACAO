import { DataPlatformRunLock, withRetry } from './worker-runtime';

describe('data platform worker runtime', () => {
  test('bloqueia execucao concorrente da mesma chave', async () => {
    const lock = new DataPlatformRunLock();
    let release!: () => void;
    const first = lock.runExclusive('ingestion:pncp', async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return 'first';
    });

    await Promise.resolve();

    expect(lock.isLocked('ingestion:pncp')).toBe(true);
    await expect(lock.runExclusive('ingestion:pncp', async () => 'second')).resolves.toEqual({ acquired: false });

    release();
    await expect(first).resolves.toEqual({ acquired: true, value: 'first' });
    expect(lock.isLocked('ingestion:pncp')).toBe(false);
  });

  test('executa retry com backoff simples', async () => {
    const sleep = jest.fn(async () => undefined);
    const attempts: number[] = [];

    const result = await withRetry(async () => {
      attempts.push(attempts.length + 1);
      if (attempts.length < 3) {
        throw new Error(`falha-${attempts.length}`);
      }
      return 'ok';
    }, {
      maxAttempts: 3,
      baseDelayMs: 10,
      sleep,
    });

    expect(result).toBe('ok');
    expect(attempts).toEqual([1, 2, 3]);
    expect(sleep).toHaveBeenNthCalledWith(1, 10);
    expect(sleep).toHaveBeenNthCalledWith(2, 20);
  });
});
