import { DataChunkingService } from './chunking.service';
import { dataPipelineMetrics, DataPipelineMetricsService } from './metrics.service';
import { DataNormalizationService } from './normalization.service';
import type { DataPipelineResult, RawDataRecord } from './types';

interface DataPipelineOptions {
  knownDedupeKeys?: Iterable<string>;
  chunking?: {
    maxChunkChars?: number;
    overlapChars?: number;
    embeddingModel?: string | null;
    embeddingDimensions?: number | null;
  };
}

export class DataIngestionPipeline {
  constructor(
    private readonly normalizer = new DataNormalizationService(),
    private readonly chunker = new DataChunkingService(),
    private readonly metrics: DataPipelineMetricsService = dataPipelineMetrics,
  ) {}

  process(records: RawDataRecord[], options: DataPipelineOptions = {}): DataPipelineResult {
    const startedAt = Date.now();
    const known = new Set(options.knownDedupeKeys ?? []);
    const accepted: DataPipelineResult['accepted'] = [];
    const duplicated: DataPipelineResult['duplicated'] = [];
    const failed: DataPipelineResult['failed'] = [];
    const chunks: DataPipelineResult['chunks'] = [];
    const searchTasks: DataPipelineResult['searchTasks'] = [];

    for (const record of records) {
      try {
        const normalized = this.normalizer.normalize(record);
        if (known.has(normalized.dedupeKey)) {
          duplicated.push(normalized);
          continue;
        }

        known.add(normalized.dedupeKey);
        accepted.push(normalized);
        chunks.push(...this.chunker.createChunks(normalized, options.chunking));
        searchTasks.push(this.chunker.createSearchTask(normalized, 'opensearch'));
        searchTasks.push(this.chunker.createSearchTask(normalized, 'pgvector'));
      } catch (error) {
        failed.push({
          record,
          reason: error instanceof Error ? error.message : 'unknown_error',
        });
      }
    }

    const result: DataPipelineResult = {
      accepted,
      duplicated,
      failed,
      chunks,
      searchTasks,
      counters: {
        seen: records.length,
        accepted: accepted.length,
        duplicated: duplicated.length,
        failed: failed.length,
        chunks: chunks.length,
        searchTasks: searchTasks.length,
      },
    };

    this.metrics.record({
      source: records[0]?.source ?? 'pncp',
      stage: 'indexing',
      status: failed.length > 0 ? 'error' : 'success',
      durationMs: Date.now() - startedAt,
      counters: result.counters,
    });

    return result;
  }
}
