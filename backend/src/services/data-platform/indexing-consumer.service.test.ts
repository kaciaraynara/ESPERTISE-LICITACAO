import { SearchIndexTaskConsumer, SearchIndexTaskRecord } from './indexing-consumer.service';
import { DataPlatformRunLock } from './worker-runtime';

function task(overrides: Partial<SearchIndexTaskRecord> = {}): SearchIndexTaskRecord {
  return {
    id: 'task-1',
    tenantId: 'tenant-1',
    targetType: 'procurement_notice',
    targetId: 'notice-1',
    engine: 'pgvector',
    operation: 'upsert',
    status: 'pending',
    attempts: 0,
    metadata: { source: 'pncp', externalId: 'PNCP-1' },
    ...overrides,
  };
}

function clientFor(record: SearchIndexTaskRecord) {
  return {
    searchIndexTask: {
      findMany: jest.fn(async () => [record]),
      updateMany: jest.fn(async ({ data }) => {
        if (record.status !== 'pending' && record.status !== 'queued') return { count: 0 };
        record.status = data.status;
        record.attempts += Number(data.attempts?.increment ?? 0);
        record.lastError = data.lastError;
        record.metadata = data.metadata;
        return { count: 1 };
      }),
      update: jest.fn(async ({ data }) => {
        record.status = data.status;
        record.lastError = data.lastError;
        record.metadata = data.metadata;
        return record;
      }),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
  };
}

describe('SearchIndexTaskConsumer', () => {
  test('marca tarefa pgvector como skipped quando nao ha provider configurado', async () => {
    const record = task({ engine: 'pgvector' });
    const client = clientFor(record);
    const events = { recordPipelineEvent: jest.fn(async () => undefined) };
    const consumer = new SearchIndexTaskConsumer(client, events);

    const result = await consumer.consumePending({ traceId: 'trace-1', sleep: async () => undefined });

    expect(result.status).toBe('completed');
    expect(result.counters).toMatchObject({
      seen: 1,
      running: 1,
      skipped: 1,
      failed: 0,
      completed: 0,
    });
    expect(record.status).toBe('skipped');
    expect(record.lastError).toBeNull();
    expect(record.metadata?.worker).toMatchObject({
      status: 'skipped',
      reason: 'pending_external_provider',
      traceId: 'trace-1',
    });
    expect(events.recordPipelineEvent).toHaveBeenCalledWith(expect.objectContaining({
      source: 'pncp',
      level: 'warn',
      metadata: expect.objectContaining({ reason: 'pending_external_provider' }),
    }));
  });

  test('marca tarefa opensearch como skipped quando nao ha engine configurado', async () => {
    const record = task({ engine: 'opensearch' });
    const client = clientFor(record);
    const events = { recordPipelineEvent: jest.fn(async () => undefined) };
    const consumer = new SearchIndexTaskConsumer(client, events);

    const result = await consumer.consumePending({ traceId: 'trace-2', sleep: async () => undefined });

    expect(result.status).toBe('completed');
    expect(result.counters).toMatchObject({
      seen: 1,
      running: 1,
      skipped: 1,
    });
    expect(record.status).toBe('skipped');
    expect(record.metadata?.worker).toMatchObject({
      status: 'skipped',
      reason: 'pending_external_engine',
      traceId: 'trace-2',
    });
    expect(events.recordPipelineEvent).toHaveBeenCalledWith(expect.objectContaining({
      source: 'pncp',
      level: 'warn',
      metadata: expect.objectContaining({ reason: 'pending_external_engine' }),
    }));
  });

  test('requeue de skipped filtra por reason e preserva tentativas', async () => {
    const records = [
      task({
        id: 'task-skipped-1',
        engine: 'pgvector',
        status: 'skipped',
        attempts: 1,
        metadata: { worker: { reason: 'pending_external_provider' } },
      }),
      task({
        id: 'task-skipped-2',
        engine: 'opensearch',
        status: 'skipped',
        attempts: 1,
        metadata: { worker: { reason: 'pending_external_engine' } },
      }),
    ];
    const client = clientForRequeue(records);
    const events = { recordPipelineEvent: jest.fn(async () => undefined) };
    const consumer = new SearchIndexTaskConsumer(client, events, {}, new DataPlatformRunLock());

    const result = await consumer.requeueSkippedTasks({
      reason: 'pending_external_provider',
      maxAttempts: 3,
      traceId: 'requeue-skipped',
    });

    expect(result.counters).toMatchObject({ seen: 2, eligible: 1, requeued: 1, blocked: 1 });
    expect(records[0].status).toBe('pending');
    expect(records[0].attempts).toBe(1);
    expect(records[0].metadata?.requeue).toMatchObject({
      previousStatus: 'skipped',
      reason: 'pending_external_provider',
      attemptsPreserved: 1,
    });
    expect(records[1].status).toBe('skipped');
    expect(events.recordPipelineEvent).toHaveBeenCalledWith(expect.objectContaining({
      stage: 'requeue',
      message: 'requeue completed',
    }));
  });

  test('requeue de failed respeita max attempts', async () => {
    const records = [
      task({ id: 'failed-1', status: 'failed', attempts: 2, lastError: 'temporary_error' }),
      task({ id: 'failed-2', status: 'failed', attempts: 3, lastError: 'temporary_error' }),
    ];
    const client = clientForRequeue(records);
    const consumer = new SearchIndexTaskConsumer(client, { recordPipelineEvent: jest.fn(async () => undefined) }, {}, new DataPlatformRunLock());

    const result = await consumer.requeueFailedTasks({ maxAttempts: 3 });

    expect(result.counters).toMatchObject({ seen: 2, eligible: 1, requeued: 1, blocked: 1 });
    expect(records[0].status).toBe('pending');
    expect(records[1].status).toBe('failed');
  });

  test('nao requeue erro permanente para evitar loop infinito', async () => {
    const records = [
      task({ id: 'failed-permanent', status: 'failed', attempts: 1, lastError: 'unsupported_engine:unknown' }),
    ];
    const client = clientForRequeue(records);
    const consumer = new SearchIndexTaskConsumer(client, { recordPipelineEvent: jest.fn(async () => undefined) }, {}, new DataPlatformRunLock());

    const result = await consumer.requeueFailedTasks({ maxAttempts: 3 });

    expect(result.counters).toMatchObject({ seen: 1, eligible: 0, requeued: 0, blocked: 1 });
    expect(records[0].status).toBe('failed');
    expect(client.searchIndexTask.update).not.toHaveBeenCalled();
  });
});

function clientForRequeue(records: SearchIndexTaskRecord[]) {
  return {
    searchIndexTask: {
      findMany: jest.fn(async () => records),
      updateMany: jest.fn(async () => ({ count: 0 })),
      update: jest.fn(async ({ where, data }) => {
        const record = records.find((item) => item.id === where.id);
        if (!record) throw new Error(`record ${where.id} not found`);
        record.status = data.status;
        record.lastError = data.lastError;
        record.metadata = data.metadata;
        return record;
      }),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
  };
}
