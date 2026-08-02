import { DataPlatformDistributedLock } from './distributed-lock.service';
import { DataPlatformRunLock } from './worker-runtime';

function clientWithLockResult(locked: boolean) {
  const tx = {
    $queryRaw: jest.fn(async () => [{ locked }]),
  };
  const client = {
    $transaction: jest.fn(async (run) => run(tx)),
  };
  return { client, tx };
}

describe('DataPlatformDistributedLock', () => {
  test('adquire lock distribuido via PostgreSQL advisory lock', async () => {
    const { client, tx } = clientWithLockResult(true);
    const events = { recordPipelineEvent: jest.fn(async () => undefined) };
    const lock = new DataPlatformDistributedLock(client, events, new DataPlatformRunLock(), {
      NODE_ENV: 'production',
      DATA_PLATFORM_DISTRIBUTED_LOCK_ENABLED: 'true',
    });

    const result = await lock.runExclusive('ingestion:pncp', async () => 'ok');

    expect(result).toEqual({ acquired: true, value: 'ok' });
    expect(client.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(events.recordPipelineEvent).toHaveBeenCalledWith(expect.objectContaining({
      source: 'data_platform',
      stage: 'lock',
      level: 'info',
      message: 'lock acquired',
      metadata: expect.objectContaining({ key: 'data-platform:ingestion:pncp' }),
    }));
  });

  test('recusa lock quando outra instancia ja possui a mesma chave', async () => {
    const { client } = clientWithLockResult(false);
    const events = { recordPipelineEvent: jest.fn(async () => undefined) };
    const run = jest.fn(async () => 'nao-deve-rodar');
    const lock = new DataPlatformDistributedLock(client, events, new DataPlatformRunLock(), {
      NODE_ENV: 'production',
      DATA_PLATFORM_DISTRIBUTED_LOCK_ENABLED: 'true',
    });

    const result = await lock.runExclusive('ingestion:pncp', run);

    expect(result).toEqual({ acquired: false });
    expect(run).not.toHaveBeenCalled();
    expect(events.recordPipelineEvent).toHaveBeenCalledWith(expect.objectContaining({
      stage: 'lock',
      level: 'warn',
      message: 'lock skipped',
      metadata: expect.objectContaining({ reason: 'already_locked' }),
    }));
  });

  test('usa lock em memoria somente no ambiente de teste', async () => {
    const client = {
      $transaction: jest.fn(async () => {
        throw new Error('nao deveria usar postgres em test');
      }),
    };
    const events = { recordPipelineEvent: jest.fn(async () => undefined) };
    const lock = new DataPlatformDistributedLock(client, events, new DataPlatformRunLock(), {
      NODE_ENV: 'test',
      DATA_PLATFORM_DISTRIBUTED_LOCK_ENABLED: 'true',
    });

    const result = await lock.runExclusive('indexing:search_tasks', async () => 'fallback-ok');

    expect(result).toEqual({ acquired: true, value: 'fallback-ok' });
    expect(client.$transaction).not.toHaveBeenCalled();
    expect(events.recordPipelineEvent).toHaveBeenCalledWith(expect.objectContaining({
      stage: 'lock',
      message: 'lock acquired',
      metadata: expect.objectContaining({
        mode: 'memory_test_lock',
        reason: 'test_environment',
      }),
    }));
  });

  test('falha fechado quando o lock distribuido esta desabilitado fora de teste', async () => {
    const { client } = clientWithLockResult(true);
    const events = { recordPipelineEvent: jest.fn(async () => undefined) };
    const run = jest.fn(async () => 'nao-deve-rodar');
    const lock = new DataPlatformDistributedLock(client, events, new DataPlatformRunLock(), {
      NODE_ENV: 'production',
      DATA_PLATFORM_DISTRIBUTED_LOCK_ENABLED: 'false',
    });

    await expect(lock.runExclusive('ingestion:pncp', run))
      .rejects.toThrow('DATA_PLATFORM_DISTRIBUTED_LOCK_DISABLED');

    expect(client.$transaction).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  test('propaga indisponibilidade do PostgreSQL sem executar fallback em memoria', async () => {
    const client = {
      $transaction: jest.fn(async () => {
        throw new Error('postgres offline');
      }),
    };
    const events = { recordPipelineEvent: jest.fn(async () => undefined) };
    const fallback = new DataPlatformRunLock();
    const fallbackSpy = jest.spyOn(fallback, 'runExclusive');
    const run = jest.fn(async () => 'nao-deve-rodar');
    const lock = new DataPlatformDistributedLock(client, events, fallback, {
      NODE_ENV: 'production',
      DATA_PLATFORM_DISTRIBUTED_LOCK_ENABLED: 'true',
    });

    await expect(lock.runExclusive('ingestion:pncp', run)).rejects.toThrow('postgres offline');

    expect(fallbackSpy).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });
});
