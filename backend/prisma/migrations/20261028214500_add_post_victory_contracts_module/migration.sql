-- CreateEnum (Safe / Idempotent)
DO $$ BEGIN
  CREATE TYPE "ContractStatus" AS ENUM ('ATIVO', 'ENCERRADO', 'SUSPENSO', 'RESCINDIDO', 'EM_RENOVACAO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AmendmentType" AS ENUM ('PRAZO', 'VALOR_ACRESCIMO', 'VALOR_SUPRESSAO', 'REAJUSTE', 'REPACTUACAO', 'REEQUILIBRIO', 'OUTRO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ValidityAlertStatus" AS ENUM ('PENDENTE', 'ALERTADO', 'RENOVADO', 'CONCLUIDO', 'VENCIDO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: contracts (Contratos Administrativos Pós-Vitória)
CREATE TABLE IF NOT EXISTS "contracts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "cnpj_empresa" TEXT,
    "procurement_notice_id" UUID,
    "proposal_id" UUID,
    "numero_contrato" TEXT NOT NULL,
    "processo_administrativo" TEXT,
    "orgao" TEXT NOT NULL,
    "cnpj_orgao" TEXT,
    "uf" TEXT,
    "objeto" TEXT NOT NULL,
    "valor_inicial" DECIMAL(18,2) NOT NULL,
    "valor_atual" DECIMAL(18,2) NOT NULL,
    "indice_reajuste" TEXT DEFAULT 'IPCA',
    "data_base_proposta" TIMESTAMPTZ(6),
    "data_assinatura" TIMESTAMPTZ(6) NOT NULL,
    "data_inicio_vigencia" TIMESTAMPTZ(6),
    "data_fim" TIMESTAMPTZ(6) NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'ATIVO',
    "observacoes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: contract_amendments (Aditivos e Apostilamentos)
CREATE TABLE IF NOT EXISTS "contract_amendments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contract_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "numero_termo" TEXT NOT NULL,
    "tipo" "AmendmentType" NOT NULL DEFAULT 'PRAZO',
    "fundamento_legal" TEXT DEFAULT 'Art. 124 da Lei 14.133/2021',
    "justificativa" TEXT,
    "valor_alteracao" DECIMAL(18,2),
    "percentual_alteracao" DECIMAL(6,2),
    "novo_valor_contrato" DECIMAL(18,2),
    "nova_data_fim" TIMESTAMPTZ(6),
    "data_assinatura" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "documento_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_amendments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: contract_validity_periods (Prazos de Vigência)
CREATE TABLE IF NOT EXISTS "contract_validity_periods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contract_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo_marco" TEXT NOT NULL DEFAULT 'VIGENCIA',
    "data_inicio" TIMESTAMPTZ(6) NOT NULL,
    "data_fim" TIMESTAMPTZ(6) NOT NULL,
    "data_alerta" TIMESTAMPTZ(6),
    "dias_antecedencia_alerta" INTEGER NOT NULL DEFAULT 60,
    "status" "ValidityAlertStatus" NOT NULL DEFAULT 'PENDENTE',
    "observacoes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_validity_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contracts_company_id_status_idx" ON "contracts"("company_id", "status");
CREATE INDEX IF NOT EXISTS "contracts_company_id_data_fim_idx" ON "contracts"("company_id", "data_fim");
CREATE INDEX IF NOT EXISTS "contracts_cnpj_empresa_idx" ON "contracts"("cnpj_empresa");
CREATE INDEX IF NOT EXISTS "contracts_procurement_notice_id_idx" ON "contracts"("procurement_notice_id");
CREATE INDEX IF NOT EXISTS "contracts_proposal_id_idx" ON "contracts"("proposal_id");

CREATE INDEX IF NOT EXISTS "contract_amendments_contract_id_idx" ON "contract_amendments"("contract_id");
CREATE INDEX IF NOT EXISTS "contract_amendments_company_id_idx" ON "contract_amendments"("company_id");
CREATE INDEX IF NOT EXISTS "contract_amendments_tipo_idx" ON "contract_amendments"("tipo");

CREATE INDEX IF NOT EXISTS "contract_validity_periods_contract_id_idx" ON "contract_validity_periods"("contract_id");
CREATE INDEX IF NOT EXISTS "contract_validity_periods_company_id_idx" ON "contract_validity_periods"("company_id");
CREATE INDEX IF NOT EXISTS "contract_validity_periods_data_fim_idx" ON "contract_validity_periods"("data_fim");
CREATE INDEX IF NOT EXISTS "contract_validity_periods_status_idx" ON "contract_validity_periods"("status");

-- AddForeignKey (Idempotent)
DO $$ BEGIN
  ALTER TABLE "contracts" ADD CONSTRAINT "contracts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "contracts" ADD CONSTRAINT "contracts_procurement_notice_id_fkey" FOREIGN KEY ("procurement_notice_id") REFERENCES "procurement_notices"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "contracts" ADD CONSTRAINT "contracts_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "contract_amendments" ADD CONSTRAINT "contract_amendments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "contract_amendments" ADD CONSTRAINT "contract_amendments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "contract_validity_periods" ADD CONSTRAINT "contract_validity_periods_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "contract_validity_periods" ADD CONSTRAINT "contract_validity_periods_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

