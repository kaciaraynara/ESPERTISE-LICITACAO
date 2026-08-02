CREATE TABLE IF NOT EXISTS "ai_runs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" TEXT,
  "user_id" TEXT,
  "request_id" TEXT,
  "purpose" TEXT NOT NULL DEFAULT 'lex_grounded_response',
  "provider" TEXT,
  "status" TEXT NOT NULL DEFAULT 'started',
  "question" TEXT NOT NULL,
  "prompt" TEXT,
  "response" TEXT,
  "source_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "chunk_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "rule_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "confidence" DECIMAL(5, 4),
  "limitations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "failure_reason" TEXT,
  "metadata" JSONB,
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ(6),
  "failed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ai_retrieval_sessions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ai_run_id" UUID NOT NULL REFERENCES "ai_runs"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  "tenant_id" TEXT,
  "query" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'running',
  "retrieval_mode" TEXT NOT NULL DEFAULT 'postgres_text',
  "sources_found" INTEGER NOT NULL DEFAULT 0,
  "chunks_found" INTEGER NOT NULL DEFAULT 0,
  "rules_found" INTEGER NOT NULL DEFAULT 0,
  "source_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "chunk_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "rule_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "context" JSONB,
  "limitations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ai_citations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ai_run_id" UUID NOT NULL REFERENCES "ai_runs"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  "retrieval_session_id" UUID REFERENCES "ai_retrieval_sessions"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  "source_type" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "chunk_id" UUID REFERENCES "document_chunks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  "rule_code" TEXT,
  "citation_type" TEXT NOT NULL DEFAULT 'chunk',
  "label" TEXT,
  "excerpt" TEXT NOT NULL,
  "confidence" DECIMAL(5, 4),
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "legal_analyses" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ai_run_id" UUID REFERENCES "ai_runs"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  "tenant_id" TEXT,
  "user_id" TEXT,
  "procurement_notice_id" UUID REFERENCES "procurement_notices"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  "analysis_type" TEXT NOT NULL DEFAULT 'lex_grounded_response',
  "status" TEXT NOT NULL DEFAULT 'completed',
  "title" TEXT,
  "summary" TEXT,
  "result" JSONB NOT NULL,
  "source_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "chunk_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "rule_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "confidence" DECIMAL(5, 4),
  "limitations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "reviewed_by_id" TEXT,
  "reviewed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "draft_evidence" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ai_run_id" UUID REFERENCES "ai_runs"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  "legal_analysis_id" UUID REFERENCES "legal_analyses"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  "source_type" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "chunk_id" UUID REFERENCES "document_chunks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  "rule_code" TEXT,
  "evidence_type" TEXT NOT NULL DEFAULT 'citation',
  "excerpt" TEXT NOT NULL,
  "confidence" DECIMAL(5, 4),
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ai_runs_tenant_created_at_idx" ON "ai_runs"("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "ai_runs_user_created_at_idx" ON "ai_runs"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "ai_runs_status_created_at_idx" ON "ai_runs"("status", "created_at");
CREATE INDEX IF NOT EXISTS "ai_runs_purpose_created_at_idx" ON "ai_runs"("purpose", "created_at");

CREATE INDEX IF NOT EXISTS "ai_retrieval_sessions_tenant_created_at_idx" ON "ai_retrieval_sessions"("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "ai_retrieval_sessions_ai_run_id_idx" ON "ai_retrieval_sessions"("ai_run_id");
CREATE INDEX IF NOT EXISTS "ai_retrieval_sessions_status_created_at_idx" ON "ai_retrieval_sessions"("status", "created_at");

CREATE INDEX IF NOT EXISTS "ai_citations_ai_run_id_idx" ON "ai_citations"("ai_run_id");
CREATE INDEX IF NOT EXISTS "ai_citations_retrieval_session_id_idx" ON "ai_citations"("retrieval_session_id");
CREATE INDEX IF NOT EXISTS "ai_citations_source_type_source_id_idx" ON "ai_citations"("source_type", "source_id");
CREATE INDEX IF NOT EXISTS "ai_citations_chunk_id_idx" ON "ai_citations"("chunk_id");
CREATE INDEX IF NOT EXISTS "ai_citations_rule_code_idx" ON "ai_citations"("rule_code");

CREATE INDEX IF NOT EXISTS "legal_analyses_tenant_created_at_idx" ON "legal_analyses"("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "legal_analyses_user_created_at_idx" ON "legal_analyses"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "legal_analyses_ai_run_id_idx" ON "legal_analyses"("ai_run_id");
CREATE INDEX IF NOT EXISTS "legal_analyses_procurement_notice_id_idx" ON "legal_analyses"("procurement_notice_id");
CREATE INDEX IF NOT EXISTS "legal_analyses_analysis_type_status_idx" ON "legal_analyses"("analysis_type", "status");

CREATE INDEX IF NOT EXISTS "draft_evidence_ai_run_id_idx" ON "draft_evidence"("ai_run_id");
CREATE INDEX IF NOT EXISTS "draft_evidence_legal_analysis_id_idx" ON "draft_evidence"("legal_analysis_id");
CREATE INDEX IF NOT EXISTS "draft_evidence_source_type_source_id_idx" ON "draft_evidence"("source_type", "source_id");
CREATE INDEX IF NOT EXISTS "draft_evidence_chunk_id_idx" ON "draft_evidence"("chunk_id");
CREATE INDEX IF NOT EXISTS "draft_evidence_rule_code_idx" ON "draft_evidence"("rule_code");
