import { DataPlatformAdminService } from './admin.service';

function serviceWith(clientOverrides: any = {}, worker: any = {}) {
  const client = {
    ...clientOverrides,
    auditEvent: {
      create: jest.fn(),
      ...(clientOverrides.auditEvent ?? {}),
    }
  };
  return {
    service: new DataPlatformAdminService(
      client,
      {
        runPncpIngestion: jest.fn(async () => ({ status: 'completed', result: { jobId: 'job-1', source: 'pncp' } })),
        runComprasGovIngestion: jest.fn(async () => ({ status: 'completed', result: { jobId: 'job-2', source: 'compras_gov' } })),
        consumeSearchIndexTasks: jest.fn(async () => ({ status: 'completed', counters: { seen: 1 } })),
        requeueSkippedTasks: jest.fn(async () => ({ status: 'completed', counters: { requeued: 1 } })),
        requeueFailedTasks: jest.fn(async () => ({ status: 'completed', counters: { requeued: 1 } })),
        cleanupOldSearchIndexTasks: jest.fn(async () => ({ deleted: 1 })),
        ...worker,
      },
    ),
    client,
  };
}

const context = {
  user: { id: 'admin-1', email: 'admin@expertise.test', role: 'fornecedor' },
  requestId: 'req-1',
  ip: '127.0.0.1',
  userAgent: 'jest',
};

describe('DataPlatformAdminService', () => {
  test('lista jobs com filtros, paginacao e metadata sanitizada', async () => {
    const findMany = jest.fn(async () => [
      {
        id: 'job-1',
        source: 'pncp',
        status: 'completed',
        metadata: { token: 'secret', filters: { uf: 'SP' } },
        createdAt: new Date('2026-06-04T12:00:00Z'),
      },
      { id: 'job-2', source: 'pncp', status: 'completed', metadata: {}, createdAt: new Date() },
    ]);
    const { service } = serviceWith({ dataIngestionJob: { findMany } });

    const result = await service.listJobs({ source: 'pncp', status: 'completed', limit: 1, offset: 0 });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ source: 'pncp', status: 'completed' }),
      take: 2,
    }));
    expect(result.data).toHaveLength(1);
    expect(result.pagination).toMatchObject({ limit: 1, offset: 0, hasMore: true, nextOffset: 1 });
    expect((result.data[0] as any).metadata).toMatchObject({ token: '[redacted]', filters: { uf: 'SP' } });
  });

  test('lista eventos com filtros funcionais', async () => {
    const findMany = jest.fn(async () => [{
      id: 'event-1',
      source: 'data_platform',
      stage: 'requeue',
      level: 'info',
      message: 'requeue completed',
      counters: { requeued: 1 },
      metadata: { authorization: 'bearer x', reason: 'pending_external_provider' },
      createdAt: new Date(),
    }]);
    const { service } = serviceWith({ dataPipelineEvent: { findMany } });

    const result = await service.listEvents({ source: 'data_platform', stage: 'requeue', level: 'info' });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ source: 'data_platform', stage: 'requeue', level: 'info' }),
    }));
    expect((result.data[0] as any).metadata).toMatchObject({ authorization: '[redacted]' });
  });

  test('lista tasks com filtro por reason sem expor metadata sensivel', async () => {
    const findMany = jest.fn(async () => [{
      id: 'task-1',
      engine: 'pgvector',
      status: 'skipped',
      attempts: 1,
      lastError: null,
      metadata: {
        worker: { reason: 'pending_external_provider' },
        rawPayload: { segredo: 'x' },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);
    const { service } = serviceWith({ searchIndexTask: { findMany } });

    const result = await service.listTasks({ engine: 'pgvector', status: 'skipped', reason: 'pending_external_provider' });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        engine: 'pgvector',
        status: 'skipped',
        OR: expect.any(Array),
      }),
    }));
    expect(result.data[0]).toMatchObject({ reason: 'pending_external_provider' });
    expect((result.data[0] as any).metadata).toMatchObject({ rawPayload: '[redacted]' });
  });

  test('lista cursores por fonte com paginacao e cursor sanitizado', async () => {
    const findMany = jest.fn(async () => [
      {
        id: 'cursor-1',
        source: 'pncp',
        cursorKey: 'daily',
        cursorValue: { lastPage: 2, token: 'secret' },
        lastSyncedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'cursor-2',
        source: 'pncp',
        cursorKey: 'weekly',
        cursorValue: { lastPage: 9 },
        lastSyncedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const { service } = serviceWith({ dataSourceCursor: { findMany } });

    const result = await service.listCursors({ source: 'pncp', limit: 1, offset: 0 });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ source: 'pncp' }),
      take: 2,
      skip: 0,
    }));
    expect(result.data).toHaveLength(1);
    expect(result.pagination).toMatchObject({ limit: 1, offset: 0, hasMore: true, nextOffset: 1 });
    expect((result.data[0] as any).cursorValue).toMatchObject({ lastPage: 2, token: '[redacted]' });
  });

  test('execucao manual de ingestao PNCP registra AuditEvent', async () => {
    const worker = { runPncpIngestion: jest.fn(async () => ({ status: 'completed', result: { jobId: 'job-1', source: 'pncp' } })) };
    const { service, client } = serviceWith({}, worker);

    const result = await service.runPncpIngestion({ limit: 5, filters: { uf: 'SP' } }, context);

    expect(worker.runPncpIngestion).toHaveBeenCalledWith({ limit: 5, filters: { uf: 'SP' } });
    expect(result).toMatchObject({ status: 'completed' });
    expect(client.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        scope: 'data_platform_admin',
        action: 'RUN_PNCP_INGESTION',
        outcome: 'success',
        userId: 'admin-1',
        requestId: 'req-1',
      })
    }));
  });

  test('requeue skipped registra auditoria administrativa', async () => {
    const worker = { requeueSkippedTasks: jest.fn(async () => ({ status: 'completed', counters: { requeued: 2 } })) };
    const { service, client } = serviceWith({}, worker);

    await service.requeueSkippedTasks({ reason: 'pending_external_provider', limit: 10 }, context);

    expect(worker.requeueSkippedTasks).toHaveBeenCalledWith({ reason: 'pending_external_provider', limit: 10 });
    expect(client.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        scope: 'data_platform_admin',
        action: 'REQUEUE_SKIPPED_TASKS',
        outcome: 'success',
        userId: 'admin-1',
      })
    }));
  });
});

