import 'dotenv/config';
import { prisma } from '../database/prisma';

async function main() {
  console.log('[PGVECTOR] Iniciando ativação segura da extensão vector e tabela base_juridica no Neon...');

  // 1. Ativa a extensão pgvector de forma não-destrutiva
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector;`);
  console.log('✔ Extensão "vector" (pgvector) ativada com sucesso.');

  // 2. Cria a tabela base_juridica (caso ainda não tenha sido aplicada via prisma migrate deploy)
  await prisma.$executeRawUnsafe(`
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
  `);

  // 3. Cria índices B-Tree e o índice vetorial HNSW para busca por similaridade de cosseno
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "base_juridica_fonte_idx" ON "base_juridica"("fonte");`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "base_juridica_tema_idx" ON "base_juridica"("tema");`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "base_juridica_artigo_referencia_idx" ON "base_juridica"("artigo_referencia");`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "base_juridica_ativo_idx" ON "base_juridica"("ativo");`,
  );
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "base_juridica_embedding_hnsw_idx"
    ON "base_juridica"
    USING hnsw ("embedding" vector_cosine_ops);
  `);

  // 4. Valida a instalação da extensão e da coluna embedding no catálogo do PostgreSQL
  const extCheck = await prisma.$queryRawUnsafe<Array<{ extname: string; extversion: string }>>(
    `SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';`,
  );

  const colCheck = await prisma.$queryRawUnsafe<
    Array<{ column_name: string; data_type: string; udt_name: string }>
  >(`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'base_juridica' AND column_name = 'embedding';
  `);

  console.log('✔ Verificação no catálogo do Neon PostgreSQL:', {
    extensaoInstalada: extCheck[0] || null,
    colunaEmbedding: colCheck[0] || null,
  });
}

main()
  .catch((err) => {
    console.error('[PGVECTOR] Erro ao configurar pgvector / base_juridica:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

