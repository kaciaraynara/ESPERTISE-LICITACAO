import { prisma } from '../../database/prisma';
import type {
  DataPipelineResult,
  DataSourceCode,
  NormalizedDataRecord,
} from './types';

interface CreateIngestionJobInput {
  tenantId?: string | null;
  source: DataSourceCode;
  connector: string;
  requestedByUserId?: string | null;
  metadata?: Record<string, unknown>;
}

interface FinishIngestionJobInput {
  jobId: string;
  result: DataPipelineResult;
}

interface FailIngestionJobInput {
  jobId: string;
  error: unknown;
}

interface RecordPipelineEventInput {
  jobId?: string | null;
  tenantId?: string | null;
  traceId?: string | null;
  source: DataSourceCode | string;
  stage: string;
  level?: 'info' | 'warn' | 'error';
  message: string;
  durationMs?: number | null;
  counters?: Record<string, number> | null;
  metadata?: Record<string, unknown> | null;
}

export class DataPlatformRepository {
  constructor(private readonly client: any = prisma as any) {}

  async createIngestionJob(input: CreateIngestionJobInput) {
    return this.client.dataIngestionJob.create({
      data: {
        tenantId: input.tenantId ?? null,
        source: input.source,
        connector: input.connector,
        status: 'running',
        pipelineStage: 'ingestion',
        requestedByUserId: input.requestedByUserId ?? null,
        startedAt: new Date(),
        metadata: input.metadata ?? undefined,
      },
    });
  }

  async finishIngestionJob(input: FinishIngestionJobInput) {
    return this.client.dataIngestionJob.update({
      where: { id: input.jobId },
      data: {
        status: input.result.failed.length > 0 ? 'completed_with_errors' : 'completed',
        pipelineStage: 'indexing',
        finishedAt: new Date(),
        recordsSeen: input.result.counters.seen,
        recordsAccepted: input.result.counters.accepted,
        recordsDuplicated: input.result.counters.duplicated,
        recordsFailed: input.result.counters.failed,
      },
    });
  }

  async failIngestionJob(input: FailIngestionJobInput) {
    return this.client.dataIngestionJob.update({
      where: { id: input.jobId },
      data: {
        status: 'failed',
        finishedAt: new Date(),
        errorMessage: errorMessage(input.error).slice(0, 1000),
      },
    });
  }

  async recordPipelineEvent(input: RecordPipelineEventInput) {
    return this.client.dataPipelineEvent.create({
      data: {
        jobId: input.jobId ?? null,
        tenantId: input.tenantId ?? null,
        traceId: input.traceId ?? null,
        source: input.source,
        stage: input.stage,
        level: input.level ?? 'info',
        message: input.message,
        durationMs: input.durationMs ?? null,
        counters: input.counters ?? undefined,
        metadata: input.metadata ?? undefined,
      },
    });
  }

  async listKnownProcurementDedupeKeys(source: DataSourceCode, tenantId?: string | null) {
    const rows = await this.client.procurementNotice.findMany({
      where: {
        source,
        tenantId: tenantId ?? null,
      },
      select: { dedupeKey: true },
    });

    return rows.map((row: { dedupeKey: string }) => row.dedupeKey);
  }

  async persistPipelineResult(result: DataPipelineResult) {
    const idByDedupeKey = new Map<string, string>();

    for (const record of result.accepted) {
      if (record.entityType !== 'procurement_notice') continue;
      const persisted = await this.upsertProcurementNotice(record);
      idByDedupeKey.set(record.dedupeKey, persisted.id);
    }

    for (const chunk of result.chunks) {
      const sourceId = idByDedupeKey.get(chunk.sourceId);
      if (!sourceId) continue;
      await this.client.documentChunk.upsert({
        where: {
          sourceType_sourceId_chunkIndex: {
            sourceType: chunk.sourceType,
            sourceId,
            chunkIndex: chunk.chunkIndex,
          },
        },
        create: {
          tenantId: chunk.tenantId,
          sourceType: chunk.sourceType,
          sourceId,
          chunkIndex: chunk.chunkIndex,
          contentHash: chunk.contentHash,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          embeddingModel: chunk.embeddingModel,
          embeddingDimensions: chunk.embeddingDimensions,
          metadata: chunk.metadata,
        },
        update: {
          contentHash: chunk.contentHash,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          embeddingModel: chunk.embeddingModel,
          embeddingDimensions: chunk.embeddingDimensions,
          metadata: chunk.metadata,
        },
      });
    }

    for (const task of result.searchTasks) {
      const targetId = idByDedupeKey.get(task.targetId);
      if (!targetId) continue;
      await this.client.searchIndexTask.create({
        data: {
          tenantId: task.tenantId,
          targetType: task.targetType,
          targetId,
          engine: task.engine,
          operation: task.operation,
          status: task.status,
          metadata: task.metadata,
        },
      });
    }

    return {
      procurementNotices: idByDedupeKey.size,
      documentChunks: result.chunks.filter((chunk) => idByDedupeKey.has(chunk.sourceId)).length,
      searchTasks: result.searchTasks.filter((task) => idByDedupeKey.has(task.targetId)).length,
    };
  }

  async updateCursor(source: DataSourceCode, tenantId: string | null | undefined, cursorKey: string, cursorValue: Record<string, unknown>) {
    const scopedTenantId = tenantId ?? 'global';
    return this.client.dataSourceCursor.upsert({
      where: {
        source_tenantId_cursorKey: {
          source,
          tenantId: scopedTenantId,
          cursorKey,
        },
      },
      create: {
        source,
        tenantId: scopedTenantId,
        cursorKey,
        cursorValue,
        lastSyncedAt: new Date(),
      },
      update: {
        cursorValue,
        lastSyncedAt: new Date(),
      },
    });
  }

  private async upsertProcurementNotice(record: NormalizedDataRecord) {
    const data = mapProcurementNoticeData(record);
    const { dedupeKey: _dedupeKey, ...updateData } = data;
    return this.client.procurementNotice.upsert({
      where: { dedupeKey: record.dedupeKey },
      create: data,
      update: updateData,
    });
  }
}

function mapProcurementNoticeData(record: NormalizedDataRecord) {
  return {
    tenantId: record.tenantId,
    source: record.source,
    externalId: record.externalId,
    dedupeKey: record.dedupeKey,
    contentHash: record.contentHash,
    noticeNumber: stringField(record.fields.noticeNumber) ?? record.externalId,
    modality: stringField(record.fields.modality),
    buyerName: stringField(record.fields.buyerName),
    buyerDocument: onlyDigits(stringField(record.fields.buyerDocument)),
    object: record.title,
    uf: stringField(record.fields.uf),
    municipality: stringField(record.fields.municipality),
    estimatedValue: numberField(record.fields.estimatedValue),
    status: stringField(record.fields.status),
    url: stringField(record.fields.url),
    publishedAt: dateField(record.fields.publishedAt ?? record.fields.sourceDate),
    openingAt: dateField(record.fields.openingAt),
    closingAt: dateField(record.fields.closingAt),
    rawPayload: record.rawPayload,
    classification: record.classification,
    metadata: record.metadata,
  };
}

function stringField(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberField(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function dateField(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function onlyDigits(value: string | null) {
  return value?.replace(/\D/g, '') || null;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
