import { DataIngestionPipeline } from './pipeline.service';
import { DataNormalizationService, stableStringify } from './normalization.service';
import type { RawDataRecord } from './types';

function rawNotice(overrides: Partial<RawDataRecord> = {}): RawDataRecord {
  return {
    source: 'pncp',
    entityType: 'procurement_notice',
    externalId: 'PNCP-001',
    fetchedAt: '2026-06-04T12:00:00.000Z',
    payload: {
      numeroControlePNCP: 'PNCP-001',
      objeto: 'Aquisicao de solucao SaaS com visita tecnica obrigatoria e marca exclusiva',
      modalidadeNome: 'Pregao eletronico',
      uf: 'SP',
      valorTotalEstimado: 120000,
    },
    ...overrides,
  };
}

describe('data platform pipeline', () => {
  test('stableStringify torna o hash independente da ordem das chaves', () => {
    expect(stableStringify({ b: 2, a: 1 })).toBe(stableStringify({ a: 1, b: 2 }));
  });

  test('normaliza, classifica risco e gera dedupe key deterministica', () => {
    const service = new DataNormalizationService();
    const first = service.normalize(rawNotice());
    const second = service.normalize(rawNotice({
      payload: {
        valorTotalEstimado: 120000,
        uf: 'SP',
        modalidadeNome: 'Pregao eletronico',
        objeto: 'Aquisicao de solucao SaaS com visita tecnica obrigatoria e marca exclusiva',
        numeroControlePNCP: 'PNCP-001',
      },
    }));

    expect(first.dedupeKey).toBe(second.dedupeKey);
    expect(first.classification.riskLevel).toBe('high');
    expect(first.fields).toMatchObject({
      entityType: 'procurement_notice',
      uf: 'SP',
      modality: 'Pregao eletronico',
      estimatedValue: 120000,
    });
  });

  test('pipeline deduplica, gera chunks e prepara tarefas para opensearch e pgvector', () => {
    const pipeline = new DataIngestionPipeline();
    const result = pipeline.process([
      rawNotice(),
      rawNotice(),
      rawNotice({ externalId: 'PNCP-002', payload: { objeto: 'Compra de notebooks para escolas publicas', id: 'PNCP-002' } }),
    ], {
      chunking: {
        maxChunkChars: 80,
        overlapChars: 10,
        embeddingModel: 'text-embedding-3-small',
        embeddingDimensions: 1536,
      },
    });

    expect(result.counters).toMatchObject({
      seen: 3,
      accepted: 2,
      duplicated: 1,
      failed: 0,
    });
    expect(result.chunks.length).toBeGreaterThanOrEqual(2);
    expect(result.chunks[0]).toMatchObject({
      embeddingModel: 'text-embedding-3-small',
      embeddingDimensions: 1536,
      sourceType: 'procurement_notice',
    });
    expect(result.searchTasks.map((task) => task.engine).sort()).toEqual([
      'opensearch',
      'opensearch',
      'pgvector',
      'pgvector',
    ]);
  });
});
