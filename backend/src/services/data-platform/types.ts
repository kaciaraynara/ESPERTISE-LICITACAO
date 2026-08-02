export type DataSourceCode =
  | 'tcu'
  | 'pncp'
  | 'compras_gov'
  | 'portal_transparencia'
  | 'receita_federal'
  | 'cade';

export type DataEntityType =
  | 'legal_document'
  | 'jurisprudence'
  | 'procurement_notice'
  | 'bidding_history'
  | 'investigation_signal'
  | 'company'
  | 'supplier'
  | 'legal_pattern';

export type DataPipelineStage =
  | 'ingestion'
  | 'normalization'
  | 'deduplication'
  | 'classification'
  | 'chunking'
  | 'vectorization'
  | 'indexing';

export type DataAccessMode = 'official_api' | 'configured_api' | 'internal_adapter';

export interface DataConnectorCapability {
  entityType: DataEntityType;
  supportsIncremental: boolean;
  supportsBulk: boolean;
}

export interface DataSourceDescriptor {
  code: DataSourceCode;
  name: string;
  accessMode: DataAccessMode;
  envBaseUrl?: string;
  safeAccessOnly: true;
  capabilities: DataConnectorCapability[];
  notes: string;
}

export interface DataFetchCursor {
  cursorKey: string;
  cursorValue?: Record<string, unknown> | null;
}

export interface DataFetchInput {
  tenantId?: string | null;
  cursor?: DataFetchCursor | null;
  limit?: number;
  since?: Date | string | null;
  filters?: Record<string, unknown>;
  traceId?: string | null;
}

export interface RawDataRecord {
  tenantId?: string | null;
  source: DataSourceCode;
  entityType: DataEntityType;
  externalId?: string | null;
  fetchedAt: string;
  payload: Record<string, unknown>;
  traceId?: string | null;
}

export interface NormalizedDataRecord {
  tenantId: string | null;
  source: DataSourceCode;
  entityType: DataEntityType;
  externalId: string | null;
  dedupeKey: string;
  contentHash: string;
  title: string;
  text: string;
  fields: Record<string, unknown>;
  classification: Record<string, unknown>;
  metadata: Record<string, unknown>;
  rawPayload: Record<string, unknown>;
}

export interface DataChunkDraft {
  tenantId: string | null;
  sourceType: DataEntityType;
  sourceId: string;
  chunkIndex: number;
  contentHash: string;
  content: string;
  tokenCount: number;
  embeddingModel: string | null;
  embeddingDimensions: number | null;
  metadata: Record<string, unknown>;
}

export interface SearchIndexTaskDraft {
  tenantId: string | null;
  targetType: DataEntityType;
  targetId: string;
  engine: 'opensearch' | 'elasticsearch' | 'pgvector';
  operation: 'upsert' | 'delete';
  status: 'pending';
  metadata: Record<string, unknown>;
}

export interface DataPipelineResult {
  accepted: NormalizedDataRecord[];
  duplicated: NormalizedDataRecord[];
  failed: Array<{ record: RawDataRecord; reason: string }>;
  chunks: DataChunkDraft[];
  searchTasks: SearchIndexTaskDraft[];
  counters: {
    seen: number;
    accepted: number;
    duplicated: number;
    failed: number;
    chunks: number;
    searchTasks: number;
  };
}

export interface DataConnector {
  descriptor: DataSourceDescriptor;
  fetch(input: DataFetchInput): Promise<RawDataRecord[]>;
}
