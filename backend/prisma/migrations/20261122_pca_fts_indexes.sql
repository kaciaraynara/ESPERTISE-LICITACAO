-- Etapa 5: Índices trigram GIN para busca PCA multi-UF / multi-CNAE em milissegundos no PostgreSQL/Neon
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_pca_items_description_trgm
  ON annual_procurement_plan_items USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_pca_items_buyer_name_trgm
  ON annual_procurement_plan_items USING gin (buyer_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_pca_items_category_trgm
  ON annual_procurement_plan_items USING gin (category gin_trgm_ops);

ANALYZE annual_procurement_plan_items;
