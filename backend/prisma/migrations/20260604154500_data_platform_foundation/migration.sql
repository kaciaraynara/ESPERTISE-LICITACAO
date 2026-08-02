-- Enable pgvector for semantic retrieval foundations.
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "data_ingestion_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT,
    "source" TEXT NOT NULL,
    "connector" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "pipeline_stage" TEXT NOT NULL DEFAULT 'ingestion',
    "requested_by_user_id" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "records_seen" INTEGER NOT NULL DEFAULT 0,
    "records_accepted" INTEGER NOT NULL DEFAULT 0,
    "records_duplicated" INTEGER NOT NULL DEFAULT 0,
    "records_failed" INTEGER NOT NULL DEFAULT 0,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_ingestion_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_source_cursors" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "source" TEXT NOT NULL,
    "cursor_key" TEXT NOT NULL,
    "cursor_value" JSONB,
    "last_synced_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_source_cursors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_pipeline_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" TEXT,
    "tenant_id" TEXT,
    "trace_id" TEXT,
    "source" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "duration_ms" INTEGER,
    "counters" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_pipeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT,
    "source" TEXT NOT NULL,
    "external_id" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "body_text" TEXT,
    "url" TEXT,
    "issued_at" TIMESTAMPTZ(6),
    "published_at" TIMESTAMPTZ(6),
    "classification" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jurisprudence" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT,
    "source" TEXT NOT NULL,
    "external_id" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "court" TEXT NOT NULL,
    "case_number" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "decision_text" TEXT,
    "decision_date" TIMESTAMPTZ(6),
    "url" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jurisprudence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_notices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT,
    "source" TEXT NOT NULL,
    "external_id" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "notice_number" TEXT,
    "modality" TEXT,
    "buyer_name" TEXT,
    "buyer_document" TEXT,
    "object" TEXT NOT NULL,
    "uf" TEXT,
    "municipality" TEXT,
    "estimated_value" DECIMAL(18,2),
    "status" TEXT,
    "url" TEXT,
    "published_at" TIMESTAMPTZ(6),
    "opening_at" TIMESTAMPTZ(6),
    "closing_at" TIMESTAMPTZ(6),
    "raw_payload" JSONB,
    "classification" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procurement_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bidding_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT,
    "source" TEXT NOT NULL,
    "external_id" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "procurement_notice_id" UUID,
    "external_notice_id" TEXT,
    "bidder_name" TEXT,
    "bidder_document" TEXT,
    "bid_value" DECIMAL(18,2),
    "rank" INTEGER,
    "is_winner" BOOLEAN NOT NULL DEFAULT false,
    "event_at" TIMESTAMPTZ(6),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bidding_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investigation_signals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT,
    "source" TEXT NOT NULL,
    "signal_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "confidence" DECIMAL(5,4),
    "subject_type" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investigation_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_companies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT,
    "source" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "trade_name" TEXT,
    "main_cnae" TEXT,
    "municipality" TEXT,
    "uf" TEXT,
    "status" TEXT,
    "partners" JSONB,
    "metadata" JSONB,
    "last_synced_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT,
    "source" TEXT NOT NULL,
    "external_id" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "cnpj" TEXT,
    "name" TEXT NOT NULL,
    "products" JSONB,
    "services" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "regions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "capacity" JSONB,
    "score" DECIMAL(6,2),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_patterns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT,
    "pattern_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "risk_level" TEXT NOT NULL,
    "legal_basis" JSONB,
    "examples" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_chunks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content_hash" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "token_count" INTEGER,
    "embedding_model" TEXT,
    "embedding_dimensions" INTEGER,
    "embedding" vector,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_index_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "engine" TEXT NOT NULL DEFAULT 'opensearch',
    "operation" TEXT NOT NULL DEFAULT 'upsert',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_index_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "data_ingestion_jobs_tenant_id_idx" ON "data_ingestion_jobs"("tenant_id");
CREATE INDEX "data_ingestion_jobs_source_status_created_at_idx" ON "data_ingestion_jobs"("source", "status", "created_at");
CREATE INDEX "data_ingestion_jobs_pipeline_stage_status_idx" ON "data_ingestion_jobs"("pipeline_stage", "status");

-- CreateIndex
CREATE UNIQUE INDEX "data_source_cursors_source_tenant_id_cursor_key_key" ON "data_source_cursors"("source", "tenant_id", "cursor_key");
CREATE INDEX "data_source_cursors_tenant_id_idx" ON "data_source_cursors"("tenant_id");
CREATE INDEX "data_source_cursors_source_last_synced_at_idx" ON "data_source_cursors"("source", "last_synced_at");

-- CreateIndex
CREATE INDEX "data_pipeline_events_job_id_idx" ON "data_pipeline_events"("job_id");
CREATE INDEX "data_pipeline_events_tenant_id_idx" ON "data_pipeline_events"("tenant_id");
CREATE INDEX "data_pipeline_events_source_stage_created_at_idx" ON "data_pipeline_events"("source", "stage", "created_at");
CREATE INDEX "data_pipeline_events_trace_id_idx" ON "data_pipeline_events"("trace_id");

-- CreateIndex
CREATE UNIQUE INDEX "legal_documents_dedupe_key_key" ON "legal_documents"("dedupe_key");
CREATE INDEX "legal_documents_tenant_id_idx" ON "legal_documents"("tenant_id");
CREATE INDEX "legal_documents_source_external_id_idx" ON "legal_documents"("source", "external_id");
CREATE INDEX "legal_documents_document_type_published_at_idx" ON "legal_documents"("document_type", "published_at");
CREATE INDEX "legal_documents_content_hash_idx" ON "legal_documents"("content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "jurisprudence_dedupe_key_key" ON "jurisprudence"("dedupe_key");
CREATE INDEX "jurisprudence_tenant_id_idx" ON "jurisprudence"("tenant_id");
CREATE INDEX "jurisprudence_source_external_id_idx" ON "jurisprudence"("source", "external_id");
CREATE INDEX "jurisprudence_court_decision_date_idx" ON "jurisprudence"("court", "decision_date");
CREATE INDEX "jurisprudence_content_hash_idx" ON "jurisprudence"("content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_notices_dedupe_key_key" ON "procurement_notices"("dedupe_key");
CREATE INDEX "procurement_notices_tenant_id_idx" ON "procurement_notices"("tenant_id");
CREATE INDEX "procurement_notices_source_external_id_idx" ON "procurement_notices"("source", "external_id");
CREATE INDEX "procurement_notices_uf_published_at_idx" ON "procurement_notices"("uf", "published_at");
CREATE INDEX "procurement_notices_modality_idx" ON "procurement_notices"("modality");
CREATE INDEX "procurement_notices_content_hash_idx" ON "procurement_notices"("content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "bidding_history_dedupe_key_key" ON "bidding_history"("dedupe_key");
CREATE INDEX "bidding_history_tenant_id_idx" ON "bidding_history"("tenant_id");
CREATE INDEX "bidding_history_source_external_id_idx" ON "bidding_history"("source", "external_id");
CREATE INDEX "bidding_history_procurement_notice_id_idx" ON "bidding_history"("procurement_notice_id");
CREATE INDEX "bidding_history_bidder_document_idx" ON "bidding_history"("bidder_document");
CREATE INDEX "bidding_history_is_winner_idx" ON "bidding_history"("is_winner");

-- CreateIndex
CREATE INDEX "investigation_signals_tenant_id_idx" ON "investigation_signals"("tenant_id");
CREATE INDEX "investigation_signals_signal_type_severity_idx" ON "investigation_signals"("signal_type", "severity");
CREATE INDEX "investigation_signals_subject_type_subject_id_idx" ON "investigation_signals"("subject_type", "subject_id");
CREATE INDEX "investigation_signals_source_created_at_idx" ON "investigation_signals"("source", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "data_companies_dedupe_key_key" ON "data_companies"("dedupe_key");
CREATE INDEX "data_companies_tenant_id_idx" ON "data_companies"("tenant_id");
CREATE INDEX "data_companies_source_cnpj_idx" ON "data_companies"("source", "cnpj");
CREATE INDEX "data_companies_uf_idx" ON "data_companies"("uf");
CREATE INDEX "data_companies_main_cnae_idx" ON "data_companies"("main_cnae");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_dedupe_key_key" ON "suppliers"("dedupe_key");
CREATE INDEX "suppliers_tenant_id_idx" ON "suppliers"("tenant_id");
CREATE INDEX "suppliers_source_external_id_idx" ON "suppliers"("source", "external_id");
CREATE INDEX "suppliers_cnpj_idx" ON "suppliers"("cnpj");

-- CreateIndex
CREATE INDEX "legal_patterns_tenant_id_idx" ON "legal_patterns"("tenant_id");
CREATE INDEX "legal_patterns_pattern_type_risk_level_idx" ON "legal_patterns"("pattern_type", "risk_level");
CREATE INDEX "legal_patterns_active_idx" ON "legal_patterns"("active");

-- CreateIndex
CREATE UNIQUE INDEX "document_chunks_source_type_source_id_chunk_index_key" ON "document_chunks"("source_type", "source_id", "chunk_index");
CREATE INDEX "document_chunks_tenant_id_idx" ON "document_chunks"("tenant_id");
CREATE INDEX "document_chunks_source_type_source_id_idx" ON "document_chunks"("source_type", "source_id");
CREATE INDEX "document_chunks_content_hash_idx" ON "document_chunks"("content_hash");

-- CreateIndex
CREATE INDEX "search_index_tasks_tenant_id_idx" ON "search_index_tasks"("tenant_id");
CREATE INDEX "search_index_tasks_target_type_target_id_idx" ON "search_index_tasks"("target_type", "target_id");
CREATE INDEX "search_index_tasks_engine_status_created_at_idx" ON "search_index_tasks"("engine", "status", "created_at");

-- AddForeignKey
ALTER TABLE "bidding_history" ADD CONSTRAINT "bidding_history_procurement_notice_id_fkey" FOREIGN KEY ("procurement_notice_id") REFERENCES "procurement_notices"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
