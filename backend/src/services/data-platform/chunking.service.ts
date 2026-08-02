import type { DataChunkDraft, NormalizedDataRecord, SearchIndexTaskDraft } from './types';
import { sha256 } from './normalization.service';

interface ChunkingOptions {
  maxChunkChars?: number;
  overlapChars?: number;
  embeddingModel?: string | null;
  embeddingDimensions?: number | null;
}

const DEFAULT_MAX_CHUNK_CHARS = 1200;
const DEFAULT_OVERLAP_CHARS = 120;

export class DataChunkingService {
  createChunks(record: NormalizedDataRecord, options: ChunkingOptions = {}): DataChunkDraft[] {
    const maxChunkChars = Math.max(200, options.maxChunkChars ?? DEFAULT_MAX_CHUNK_CHARS);
    const overlapChars = Math.min(Math.max(0, options.overlapChars ?? DEFAULT_OVERLAP_CHARS), Math.floor(maxChunkChars / 2));
    const cleaned = normalizeWhitespace(record.text);

    if (!cleaned) return [];

    const chunks: DataChunkDraft[] = [];
    let start = 0;
    let chunkIndex = 0;

    while (start < cleaned.length) {
      const end = findChunkEnd(cleaned, start, maxChunkChars);
      const content = cleaned.slice(start, end).trim();

      if (content) {
        chunks.push({
          tenantId: record.tenantId,
          sourceType: record.entityType,
          sourceId: record.dedupeKey,
          chunkIndex,
          contentHash: sha256(content),
          content,
          tokenCount: estimateTokenCount(content),
          embeddingModel: options.embeddingModel ?? null,
          embeddingDimensions: options.embeddingDimensions ?? null,
          metadata: {
            source: record.source,
            externalId: record.externalId,
            parentContentHash: record.contentHash,
            classification: record.classification,
          },
        });
        chunkIndex += 1;
      }

      if (end >= cleaned.length) break;
      start = Math.max(end - overlapChars, start + 1);
    }

    return chunks;
  }

  createSearchTask(record: NormalizedDataRecord, engine: SearchIndexTaskDraft['engine'] = 'opensearch'): SearchIndexTaskDraft {
    return {
      tenantId: record.tenantId,
      targetType: record.entityType,
      targetId: record.dedupeKey,
      engine,
      operation: 'upsert',
      status: 'pending',
      metadata: {
        source: record.source,
        externalId: record.externalId,
        contentHash: record.contentHash,
      },
    };
  }
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function findChunkEnd(value: string, start: number, maxChunkChars: number) {
  const hardEnd = Math.min(start + maxChunkChars, value.length);
  if (hardEnd >= value.length) return value.length;

  const window = value.slice(start, hardEnd);
  const lastSentence = Math.max(window.lastIndexOf('. '), window.lastIndexOf('; '), window.lastIndexOf('\n'));
  if (lastSentence > maxChunkChars * 0.55) return start + lastSentence + 1;

  const lastSpace = window.lastIndexOf(' ');
  if (lastSpace > maxChunkChars * 0.55) return start + lastSpace;

  return hardEnd;
}

function estimateTokenCount(value: string) {
  return Math.max(1, Math.ceil(value.length / 4));
}
