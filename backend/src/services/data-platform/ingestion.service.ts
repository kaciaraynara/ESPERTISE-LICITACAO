import { randomUUID } from 'crypto';
import { ComprasGovDataConnector } from './connectors/comprasgov.adapter';
import { PncpDataConnector } from './connectors/pncp.adapter';
import { DataIngestionPipeline } from './pipeline.service';
import { DataPlatformRepository } from './repository.service';
import type { DataConnector, DataFetchInput, DataPipelineResult, DataSourceCode } from './types';

export interface RunIngestionInput extends DataFetchInput {
  requestedByUserId?: string | null;
}

export interface RunIngestionResult {
  jobId: string;
  source: DataSourceCode;
  result: DataPipelineResult;
  persisted: {
    procurementNotices: number;
    documentChunks: number;
    searchTasks: number;
  };
}

interface RepositoryLike {
  createIngestionJob(input: {
    tenantId?: string | null;
    source: DataSourceCode;
    connector: string;
    requestedByUserId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<{ id: string }>;
  finishIngestionJob(input: { jobId: string; result: DataPipelineResult }): Promise<unknown>;
  failIngestionJob(input: { jobId: string; error: unknown }): Promise<unknown>;
  recordPipelineEvent(input: {
    jobId?: string | null;
    tenantId?: string | null;
    traceId?: string | null;
    source: DataSourceCode;
    stage: string;
    level?: 'info' | 'warn' | 'error';
    message: string;
    durationMs?: number | null;
    counters?: Record<string, number> | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<unknown>;
  listKnownProcurementDedupeKeys(source: DataSourceCode, tenantId?: string | null): Promise<string[]>;
  persistPipelineResult(result: DataPipelineResult): Promise<RunIngestionResult['persisted']>;
  updateCursor(source: DataSourceCode, tenantId: string | null | undefined, cursorKey: string, cursorValue: Record<string, unknown>): Promise<unknown>;
}

export class DataPlatformIngestionService {
  constructor(
    private readonly repository: RepositoryLike = new DataPlatformRepository(),
    private readonly pipeline = new DataIngestionPipeline(),
    private readonly pncpConnector: DataConnector = new PncpDataConnector(),
    private readonly comprasGovConnector: DataConnector = new ComprasGovDataConnector(),
  ) {}

  ingestPncp(input: RunIngestionInput = {}) {
    return this.run(this.pncpConnector, input);
  }

  ingestComprasGov(input: RunIngestionInput = {}) {
    return this.run(this.comprasGovConnector, input);
  }

  private async run(connector: DataConnector, input: RunIngestionInput): Promise<RunIngestionResult> {
    const traceId = input.traceId ?? randomUUID();
    const source = connector.descriptor.code;
    const startedAt = Date.now();
    const job = await this.repository.createIngestionJob({
      tenantId: input.tenantId ?? null,
      source,
      connector: connector.constructor.name,
      requestedByUserId: input.requestedByUserId ?? null,
      metadata: {
        filters: input.filters ?? {},
        limit: input.limit ?? null,
        since: normalizeSince(input.since),
        traceId,
      },
    });

    try {
      await this.repository.recordPipelineEvent({
        jobId: job.id,
        tenantId: input.tenantId ?? null,
        traceId,
        source,
        stage: 'ingestion',
        message: `Iniciando ingestao ${source}`,
      });

      const rawRecords = await connector.fetch({ ...input, traceId });
      await this.repository.recordPipelineEvent({
        jobId: job.id,
        tenantId: input.tenantId ?? null,
        traceId,
        source,
        stage: 'normalization',
        message: `${rawRecords.length} registros recebidos de ${source}`,
        counters: { received: rawRecords.length },
      });

      const knownDedupeKeys = await this.repository.listKnownProcurementDedupeKeys(source, input.tenantId ?? null);
      const result = this.pipeline.process(rawRecords, {
        knownDedupeKeys,
        chunking: {
          embeddingModel: process.env.DATA_PLATFORM_EMBEDDING_MODEL || 'text-embedding-3-small',
          embeddingDimensions: resolveEmbeddingDimensions(),
        },
      });

      const persisted = await this.repository.persistPipelineResult(result);
      await this.repository.finishIngestionJob({ jobId: job.id, result });
      await this.repository.updateCursor(source, input.tenantId ?? null, 'default', {
        traceId,
        lastRunAt: new Date().toISOString(),
        filters: input.filters ?? {},
        counters: result.counters,
      });

      await this.repository.recordPipelineEvent({
        jobId: job.id,
        tenantId: input.tenantId ?? null,
        traceId,
        source,
        stage: 'indexing',
        message: `Ingestao ${source} concluida`,
        durationMs: Date.now() - startedAt,
        counters: {
          ...result.counters,
          persistedProcurementNotices: persisted.procurementNotices,
          persistedDocumentChunks: persisted.documentChunks,
          persistedSearchTasks: persisted.searchTasks,
        },
      });

      return {
        jobId: job.id,
        source,
        result,
        persisted,
      };
    } catch (error) {
      await this.repository.failIngestionJob({ jobId: job.id, error });
      await this.repository.recordPipelineEvent({
        jobId: job.id,
        tenantId: input.tenantId ?? null,
        traceId,
        source,
        stage: 'ingestion',
        level: 'error',
        message: error instanceof Error ? error.message : 'Falha desconhecida na ingestao',
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  }
}

function normalizeSince(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function resolveEmbeddingDimensions() {
  const dimensions = Number(process.env.DATA_PLATFORM_EMBEDDING_DIMENSIONS || 1536);
  return Number.isFinite(dimensions) && dimensions > 0 ? dimensions : 1536;
}
