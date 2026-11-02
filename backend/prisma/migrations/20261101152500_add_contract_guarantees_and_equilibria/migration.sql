ALTER TABLE "contracts"
  ADD COLUMN "is_fornecimento_geral" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "contracts_id_company_id_key"
  ON "contracts"("id", "company_id");

CREATE TYPE "ContractEquilibriumInstitute" AS ENUM ('REAJUSTE', 'REPACTUACAO', 'REVISAO');

CREATE TABLE "contract_guarantees" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "contract_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "tipo_garantia" "GuaranteeType" NOT NULL,
  "modalidade" "GuaranteeModality" NOT NULL,
  "valor_garantido" DECIMAL(18, 2) NOT NULL,
  "data_vencimento" DATE,
  "status" "GuaranteeStatus" NOT NULL DEFAULT 'RETIDA',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contract_guarantees_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contract_guarantees_contract_company_fkey"
    FOREIGN KEY ("contract_id", "company_id")
    REFERENCES "contracts"("id", "company_id")
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "contract_guarantees_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "contract_guarantees_company_id_status_idx"
  ON "contract_guarantees"("company_id", "status");
CREATE INDEX "contract_guarantees_company_id_data_vencimento_idx"
  ON "contract_guarantees"("company_id", "data_vencimento");
CREATE INDEX "contract_guarantees_contract_id_company_id_idx"
  ON "contract_guarantees"("contract_id", "company_id");

CREATE TABLE "contract_equilibria" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "contract_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "instituto_juridico" "ContractEquilibriumInstitute" NOT NULL,
  "data_base" DATE NOT NULL,
  "data_aniversario" DATE NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contract_equilibria_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contract_equilibria_contract_company_fkey"
    FOREIGN KEY ("contract_id", "company_id")
    REFERENCES "contracts"("id", "company_id")
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "contract_equilibria_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "contract_equilibria_company_id_instituto_juridico_data_aniversario_idx"
  ON "contract_equilibria"("company_id", "instituto_juridico", "data_aniversario");
CREATE INDEX "contract_equilibria_contract_id_company_id_idx"
  ON "contract_equilibria"("contract_id", "company_id");
