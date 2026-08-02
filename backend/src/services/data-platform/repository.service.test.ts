import { DataIngestionPipeline } from './pipeline.service';
import { DataPlatformRepository } from './repository.service';
import type { RawDataRecord } from './types';

function rawNotice(): RawDataRecord {
  return {
    source: 'pncp',
    entityType: 'procurement_notice',
    externalId: 'PNCP-PERSIST-001',
    fetchedAt: '2026-06-04T12:00:00.000Z',
    payload: {
      numeroControlePNCP: 'PNCP-PERSIST-001',
      objeto: 'Contratacao de servico continuado com termo de referencia',
      modalidade: 'Pregao eletronico',
      orgao: 'Orgao Persistencia',
      orgaoCnpj: '11222333000181',
      uf: 'RJ',
      municipio: 'Rio de Janeiro',
      valorTotalEstimado: 50000,
      dataPublicacaoPncp: '2026-06-04',
      linkEditalPNCP: 'https://pncp.gov.br/teste',
    },
  };
}

describe('DataPlatformRepository', () => {
  test('persiste ProcurementNotice, DocumentChunk e SearchIndexTask usando o id real do aviso', async () => {
    const client = {
      procurementNotice: {
        upsert: jest.fn().mockImplementation(async ({ create }) => ({ id: 'notice-db-1', ...create })),
      },
      documentChunk: {
        upsert: jest.fn().mockResolvedValue({ id: 'chunk-1' }),
      },
      searchIndexTask: {
        create: jest.fn().mockResolvedValue({ id: 'task-1' }),
      },
    };
    const result = new DataIngestionPipeline().process([rawNotice()]);
    const repository = new DataPlatformRepository(client);

    const persisted = await repository.persistPipelineResult(result);

    expect(persisted).toEqual({
      procurementNotices: 1,
      documentChunks: result.chunks.length,
      searchTasks: 2,
    });
    expect(client.procurementNotice.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { dedupeKey: result.accepted[0].dedupeKey },
    }));
    expect(client.documentChunk.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        sourceType_sourceId_chunkIndex: {
          sourceType: 'procurement_notice',
          sourceId: 'notice-db-1',
          chunkIndex: 0,
        },
      },
    }));
    expect(client.searchIndexTask.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        targetType: 'procurement_notice',
        targetId: 'notice-db-1',
        status: 'pending',
      }),
    }));
  });
});
