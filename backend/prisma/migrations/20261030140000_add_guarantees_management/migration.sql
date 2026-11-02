DO $$ BEGIN
  CREATE TYPE "GuaranteeType" AS ENUM ('PROPOSTA', 'CONTRATO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "GuaranteeModality" AS ENUM ('CAUCAO', 'SEGURO', 'FIANCA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "GuaranteeStatus" AS ENUM ('RETIDA', 'PRONTA_RESGATE', 'RESGATADA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "guarantees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "proposal_id" UUID,
    "contract_id" UUID,
    "tipo_garantia" "GuaranteeType" NOT NULL,
    "modalidade" "GuaranteeModality" NOT NULL,
    "valor_original" DECIMAL(18,2) NOT NULL,
    "status" "GuaranteeStatus" NOT NULL DEFAULT 'RETIDA',
    "comprovante_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guarantees_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "guarantees_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT "guarantees_proposal_id_fkey"
      FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION,
    CONSTRAINT "guarantees_contract_id_fkey"
      FOREIGN KEY ("contract_id") REFERENCES "contracts"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "guarantees_company_id_status_idx"
  ON "guarantees"("company_id", "status");
CREATE INDEX IF NOT EXISTS "guarantees_company_id_created_at_idx"
  ON "guarantees"("company_id", "created_at");
CREATE INDEX IF NOT EXISTS "guarantees_proposal_id_idx"
  ON "guarantees"("proposal_id");
CREATE INDEX IF NOT EXISTS "guarantees_contract_id_idx"
  ON "guarantees"("contract_id");
