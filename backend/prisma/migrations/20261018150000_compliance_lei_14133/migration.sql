-- Migration: 20261018150000_compliance_lei_14133
-- Adequação do banco de dados à Nova Lei de Licitações (Lei nº 14.133/2021)

-- 1. Novos Tipos de Prazos Legais (Art. 64, 90, 165)
ALTER TYPE "DeadlineType" ADD VALUE IF NOT EXISTS 'INTENTION_TO_APPEAL';
ALTER TYPE "DeadlineType" ADD VALUE IF NOT EXISTS 'HABILITATION_COMPLEMENT';
ALTER TYPE "DeadlineType" ADD VALUE IF NOT EXISTS 'CONTRACT_SIGNING';

-- 2. Editais / Licitações (ProcurementNotice) - Art. 17 (Inversão de Fases), Art. 55 (Prazos Mínimos), Processo e SRP
ALTER TABLE "procurement_notices" 
  ADD COLUMN IF NOT EXISTS "processo_administrativo" TEXT,
  ADD COLUMN IF NOT EXISTS "inversao_fases" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "fase_habilitacao_previa" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "prazo_minimo_dias_uteis" INTEGER,
  ADD COLUMN IF NOT EXISTS "modo_disputa" TEXT,
  ADD COLUMN IF NOT EXISTS "srp" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "amparo_legal" TEXT DEFAULT 'Lei 14.133/2021';

-- 3. Propostas Comerciais (Proposals) - Declarações Legais Obrigatórias e BDI/Margens (Art. 63 e Art. 90)
ALTER TABLE "proposals"
  ADD COLUMN IF NOT EXISTS "criterio_julgamento" "JudgmentCriterion",
  ADD COLUMN IF NOT EXISTS "bdi_geral" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "encargos_sociais" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "margem_minima_sustentavel" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "valor_total_proposto" DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS "declaracao_independente" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "declaracao_habilitacao" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "declaracao_menor" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "declaracao_me_epp" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "declaracao_inidoneidade" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "declaracao_acessibilidade" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "proposta_formatada_text" TEXT;

-- 4. Itens da Proposta (ProposalItems) - Planilha de Custos, BDI, Encargos e Inexequibilidade (Art. 59, III)
ALTER TABLE "proposal_items"
  ADD COLUMN IF NOT EXISTS "custo_direto" DECIMAL(18,4),
  ADD COLUMN IF NOT EXISTS "custo_indireto" DECIMAL(18,4),
  ADD COLUMN IF NOT EXISTS "tributos_percentual" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "encargos_percentual" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "bdi_percentual" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "margem_lucro_percentual" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "desconto_percentual" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "inexequivel" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "prazo_garantia_meses" INTEGER;

-- 5. Prazos e Controle Decadencial (Deadlines) - Fundamentação Legal e Contagem Útil (Art. 164 e 165)
ALTER TABLE "deadlines"
  ADD COLUMN IF NOT EXISTS "fundamento_legal" TEXT,
  ADD COLUMN IF NOT EXISTS "dias_uteis_antecedencia" INTEGER,
  ADD COLUMN IF NOT EXISTS "dias_corridos_ate_prazo" INTEGER,
  ADD COLUMN IF NOT EXISTS "tempestivo_hoje" BOOLEAN;
