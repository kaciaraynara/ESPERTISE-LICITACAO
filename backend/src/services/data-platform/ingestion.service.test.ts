import { DataPlatformIngestionService } from './ingestion.service';
import type { DataConnector, DataPipelineResult, DataSourceCode, RawDataRecord } from './types';

function rawNotice(overrides: Partial<RawDataRecord> = {}): RawDataRecord {
  return {
    tenantId: 'tenant-1',
    source: 'pncp',
    entityType: 'procurement_notice',
    externalId: 'PNCP-RUN-001',
    fetchedAt: '2026-06-04T12:00:00.000Z',
    payload: {
      numeroControlePNCP: 'PNCP-RUN-001',
      objeto: 'Contratacao de plataforma SaaS com termo de referencia detalhado',
      modalidade: 'Pregao eletronico',
      orgao: 'Orgao de Teste',
      uf: 'DF',
      valorTotalEstimado: 150000,
    },
    ...overrides,
  };
}

function connector(source: DataSourceCode, records: RawDataRecord[]): DataConnector {
  return {
    descriptor: {
      code: source,
      name: source,
      accessMode: 'internal_adapter',
      safeAccessOnly: true,
      capabilities: [{ entityType: 'procurement_notice', supportsIncremental: true, supportsBulk: true }],
      notes: 'test',
    },
    fetch: jest.fn(async () => records.map((record) => ({ ...record, source }))),
  };
}

function repository(knownDedupeKeys: string[] = []) {
  return {
    createIngestionJob: jest.fn(async () => ({ id: 'job-1' })),
    finishIngestionJob: jest.fn(async () => undefined),
    failIngestionJob: jest.fn(async () => undefined),
    recordPipelineEvent: jest.fn(async () => undefined),
    listKnownProcurementDedupeKeys: jest.fn(async () => knownDedupeKeys),
    persistPipelineResult: jest.fn(async (result: DataPipelineResult) => ({
      procurementNotices: result.accepted.length,
      documentChunks: result.chunks.length,
      searchTasks: result.searchTasks.length,
    })),
    updateCursor: jest.fn(async () => undefined),
  };
}

describe('DataPlatformIngestionService', () => {
  test('executa ingestao PNCP registrando job, eventos, persistencia e cursor', async () => {
    const repo = repository();
    const pncp = connector('pncp', [rawNotice()]);
    const comprasGov = connector('compras_gov', []);
    const service = new DataPlatformIngestionService(repo, undefined, pncp, comprasGov);

    const output = await service.ingestPncp({
      tenantId: 'tenant-1',
      requestedByUserId: 'user-1',
      limit: 1,
      filters: { uf: 'DF' },
      traceId: 'trace-1',
    });

    expect(output.source).toBe('pncp');
    expect(output.result.counters).toMatchObject({
      seen: 1,
      accepted: 1,
      duplicated: 0,
      failed: 0,
      searchTasks: 2,
    });
    expect(repo.createIngestionJob).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      source: 'pncp',
      requestedByUserId: 'user-1',
    }));
    expect(repo.persistPipelineResult).toHaveBeenCalledWith(expect.objectContaining({
      accepted: expect.arrayContaining([expect.objectContaining({ source: 'pncp', entityType: 'procurement_notice' })]),
    }));
    expect(repo.finishIngestionJob).toHaveBeenCalledWith(expect.objectContaining({ jobId: 'job-1' }));
    expect(repo.updateCursor).toHaveBeenCalledWith(
      'pncp',
      'tenant-1',
      'default',
      expect.objectContaining({
        traceId: 'trace-1',
        filters: { uf: 'DF' },
      }),
    );
    expect(repo.recordPipelineEvent).toHaveBeenCalledWith(expect.objectContaining({ stage: 'ingestion' }));
    expect(repo.recordPipelineEvent).toHaveBeenCalledWith(expect.objectContaining({ stage: 'normalization' }));
    expect(repo.recordPipelineEvent).toHaveBeenCalledWith(expect.objectContaining({ stage: 'indexing' }));
  });

  test('respeita deduplicacao ja existente antes de persistir Compras.gov', async () => {
    const raw = rawNotice({
      source: 'compras_gov',
      externalId: 'COMPRAS-RUN-001',
      payload: {
        id: 'COMPRAS-RUN-001',
        numero: '12/2026',
        objeto: 'Aquisicao de notebooks para escolas publicas',
        orgao: 'UASG Teste',
        uf: 'SP',
        modalidade: 'Pregao',
        valorEstimado: 90000,
      },
    });
    const tempRepo = repository();
    const comprasGov = connector('compras_gov', [raw]);
    const serviceForKey = new DataPlatformIngestionService(tempRepo, undefined, connector('pncp', []), comprasGov);
    const firstRun = await serviceForKey.ingestComprasGov({ tenantId: 'tenant-1' });
    const existingDedupeKey = firstRun.result.accepted[0].dedupeKey;

    const repo = repository([existingDedupeKey]);
    const service = new DataPlatformIngestionService(repo, undefined, connector('pncp', []), comprasGov);
    const output = await service.ingestComprasGov({ tenantId: 'tenant-1' });

    expect(output.result.counters).toMatchObject({
      seen: 1,
      accepted: 0,
      duplicated: 1,
      chunks: 0,
      searchTasks: 0,
    });
    expect(repo.persistPipelineResult).toHaveBeenCalledWith(expect.objectContaining({
      accepted: [],
      chunks: [],
      searchTasks: [],
    }));
    expect(output.persisted).toEqual({
      procurementNotices: 0,
      documentChunks: 0,
      searchTasks: 0,
    });
  });
});
