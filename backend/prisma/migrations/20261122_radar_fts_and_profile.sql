-- Etapa 2: Extensões FTS/Unaccent, Classificação de Tipo de Objeto, Trigger, Índices e Perfil de Radar

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT public.unaccent('public.unaccent', $1); $$;

CREATE OR REPLACE FUNCTION public.classify_procurement_object_type(p_object text, p_modality text)
RETURNS varchar(20)
LANGUAGE plpgsql
IMMUTABLE PARALLEL SAFE
AS $$
DECLARE
  v_text text;
BEGIN
  v_text := regexp_replace(lower(public.immutable_unaccent(coalesce(p_object, ''))), '\s+', ' ', 'g');
  IF v_text = '' THEN
    RETURN NULL;
  END IF;

  IF v_text ~ '\m(obra|obras|reforma|reformas|construcao|construcoes|pavimentacao|drenagem|edificacao|engenharia civil|infraestrutura|recapeamento|terraplanagem|esgotamento sanitario|ponte|viaduto|urbanizacao|creche.*construcao|ampliacao de predio|ampliacao da escola|ampliacao de ubs|execucao de obra|execucao de reforma)\M'
     AND v_text !~ '\m(material|materiais|insumo|insumos|ferramenta|ferramentas|equipamento|equipamentos) de construcao\M'
     AND NOT (
       v_text ~ '^\s*(aquisicao|compra|fornecimento|eventual aquisicao|registro de precos para (eventual )?aquisicao)\M'
       AND v_text !~ '\m(contratacao de empresa|execucao de obra|execucao de reforma|servicos de engenharia)\M'
     ) THEN
    RETURN 'OBRAS';
  END IF;

  IF v_text ~ '\m(aquisicao|fornecimento|compra de|material|materiais|equipamento|equipamentos|veiculo|veiculos|mobiliario|moveis|medicamento|medicamentos|uniforme|uniformes|fardamento|vestuario|roupa|roupas|calcado|calcados|enxoval|generos alimenticios|alimentos|merenda|combustivel|combustiveis|pecas|computador|computadores|notebook|impressora|toner|papelaria|insumo|insumos|maquina|maquinas|ferramenta|ferramentas|pneu|pneus|kit escolar|cesta basica|epi|epis)\M'
     AND v_text !~ '\m(prestacao de servico|prestacao de servicos|locacao|terceirizacao|vigilancia|consultoria|assessoria|auditoria|contabilidade|advocacia|coleta de residuos|zeladoria)\M'
     AND v_text !~ '^\s*contratacao de (empresa|servico|servicos)\M' THEN
    RETURN 'BENS';
  END IF;

  IF v_text ~ '\m(prestacao de servico|prestacao de servicos|contratacao de empresa especializada|contratacao de servico|contratacao de servicos|manutencao|locacao|vigilancia|limpeza|conservacao|terceirizacao|consultoria|assessoria|treinamento|capacitacao|transporte escolar|frete|software|licenca|licenciamento|sistema de gestao|hospedagem|nuvem|exames|laboratorio|seguro|publicidade|eventos|dedetizacao|coleta de residuos|zeladoria|apoio administrativo|auditoria|contabilidade|advocacia|engenharia consultiva|assistencia tecnica|calibracao)\M' THEN
    RETURN 'SERVICOS';
  END IF;

  RETURN NULL;
END;
$$;

ALTER TABLE procurement_notices ADD COLUMN IF NOT EXISTS object_type VARCHAR(20);
ALTER TABLE procurement_notices ADD COLUMN IF NOT EXISTS search_vector tsvector;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS radar_tipos_objeto TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE companies ADD COLUMN IF NOT EXISTS radar_incluir_sem_classificacao BOOLEAN NOT NULL DEFAULT TRUE;

CREATE OR REPLACE FUNCTION public.trg_procurement_notices_enrich()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('portuguese', public.immutable_unaccent(coalesce(NEW.object, ''))), 'A') ||
    setweight(to_tsvector('portuguese', public.immutable_unaccent(coalesce(NEW.buyer_name, ''))), 'B') ||
    setweight(to_tsvector('portuguese', public.immutable_unaccent(coalesce(NEW.municipality, '') || ' ' || coalesce(NEW.notice_number, '') || ' ' || coalesce(NEW.external_id, ''))), 'C');

  NEW.object_type := COALESCE(
    NULLIF(BTRIM(NEW.object_type), ''),
    public.classify_procurement_object_type(NEW.object, NEW.modality)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_procurement_notices_enrich ON public.procurement_notices;
CREATE TRIGGER trg_procurement_notices_enrich
BEFORE INSERT OR UPDATE OF object, buyer_name, municipality, notice_number, external_id, modality, object_type
ON public.procurement_notices
FOR EACH ROW
EXECUTE FUNCTION public.trg_procurement_notices_enrich();

CREATE INDEX IF NOT EXISTS idx_procurement_notices_search_vector ON procurement_notices USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_procurement_notices_buyer_name_trgm ON procurement_notices USING GIN (buyer_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_procurement_notices_source_published ON procurement_notices (source, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_procurement_notices_object_type_published ON procurement_notices (object_type, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_procurement_notices_uf_closing_published ON procurement_notices (uf, closing_at, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_procurement_notices_value_published ON procurement_notices (estimated_value DESC NULLS LAST, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_procurement_notices_srp_published ON procurement_notices (published_at DESC) WHERE srp = true;
