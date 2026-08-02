-- The canonical procurement data is stored in procurement_notices.
-- Copy any remaining legacy records before removing the obsolete cache table.
INSERT INTO "procurement_notices" (
  "id", "source", "external_id", "dedupe_key", "content_hash", "notice_number",
  "modality", "buyer_name", "buyer_document", "object", "uf", "municipality",
  "estimated_value", "status", "url", "published_at", "opening_at", "closing_at",
  "metadata", "created_at", "updated_at"
)
SELECT
  gen_random_uuid(), COALESCE("fonte", 'PNCP'), "numero_controle_pncp",
  COALESCE("fonte", 'PNCP') || ':' || "numero_controle_pncp",
  md5(concat_ws('|', "numero_controle_pncp", "objeto", "atualizado_em"::text)),
  "numero_controle_pncp", "modalidade", "razao_social_orgao", "cnpj_orgao",
  COALESCE("objeto", 'Objeto não informado'), "uf", "municipio", "valor_estimado",
  "situacao", "link", "data_publicacao", "data_abertura", "data_encerramento",
  jsonb_build_object('srp', "srp", 'migratedFrom', 'licitacoes_cache'),
  "atualizado_em", "atualizado_em"
FROM "licitacoes_cache"
ON CONFLICT ("dedupe_key") DO NOTHING;

DROP TABLE "licitacoes_cache";
