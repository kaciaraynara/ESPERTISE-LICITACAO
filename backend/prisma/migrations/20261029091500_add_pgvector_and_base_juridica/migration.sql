-- 1. Habilita a extensão pgvector no PostgreSQL (Neon) de forma segura e idempotente
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Cria a tabela base_juridica sem afetar nenhuma tabela ou dado existente dos clientes
CREATE TABLE IF NOT EXISTS "base_juridica" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "titulo" TEXT NOT NULL,
    "fonte" TEXT NOT NULL DEFAULT 'LEI_14133',
    "tipo_norma" TEXT,
    "numero_norma" TEXT,
    "artigo_referencia" TEXT,
    "tema" TEXT,
    "conteudo" TEXT NOT NULL,
    "resumo" TEXT,
    "url_oficial" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "embedding_model" TEXT DEFAULT 'text-embedding-004',
    "embedding" vector(768),
    "metadata" JSONB,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "base_juridica_pkey" PRIMARY KEY ("id")
);

-- 3. Índices de filtragem rápida (B-Tree)
CREATE INDEX IF NOT EXISTS "base_juridica_fonte_idx" ON "base_juridica"("fonte");
CREATE INDEX IF NOT EXISTS "base_juridica_tema_idx" ON "base_juridica"("tema");
CREATE INDEX IF NOT EXISTS "base_juridica_artigo_referencia_idx" ON "base_juridica"("artigo_referencia");
CREATE INDEX IF NOT EXISTS "base_juridica_ativo_idx" ON "base_juridica"("ativo");

-- 4. Índice Vetorial HNSW (Cosine Distance) para busca semântica de alta velocidade no pgvector
CREATE INDEX IF NOT EXISTS "base_juridica_embedding_hnsw_idx"
ON "base_juridica"
USING hnsw ("embedding" vector_cosine_ops);

