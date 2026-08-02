-- Reconcile indexes already existing in Supabase database
-- with Prisma migration history. Safe/idempotent migration.

CREATE INDEX IF NOT EXISTS "licitacoes_cache_atualizado_em_idx"
ON "licitacoes_cache" ("atualizado_em");

CREATE INDEX IF NOT EXISTS "licitacoes_cache_data_publicacao_idx"
ON "licitacoes_cache" ("data_publicacao");

CREATE INDEX IF NOT EXISTS "idx_licitacoes_modalidade"
ON "licitacoes_cache" ("modalidade");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'licitacoes_cache_uf_idx'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_licitacoes_uf'
  )
  THEN
    ALTER INDEX "licitacoes_cache_uf_idx" RENAME TO "idx_licitacoes_uf";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'licitacoes_cache_modalidade_idx'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_licitacoes_modalidade'
  )
  THEN
    ALTER INDEX "licitacoes_cache_modalidade_idx" RENAME TO "idx_licitacoes_modalidade";
  END IF;
END $$;
