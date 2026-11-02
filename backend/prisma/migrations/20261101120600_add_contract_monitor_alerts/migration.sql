ALTER TABLE "guarantees"
  ADD COLUMN "data_vencimento" DATE,
  ADD COLUMN "status_alerta" TEXT NOT NULL DEFAULT 'PENDENTE';

CREATE INDEX "guarantees_data_vencimento_status_idx"
  ON "guarantees"("data_vencimento", "status");

CREATE TABLE "contract_monitor_alerts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "dedupe_key" TEXT NOT NULL,
  "company_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_id" UUID NOT NULL,
  "alert_type" TEXT NOT NULL,
  "days_before" INTEGER NOT NULL,
  "due_date" DATE NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contract_monitor_alerts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contract_monitor_alerts_dedupe_key_key"
  ON "contract_monitor_alerts"("dedupe_key");
CREATE INDEX "contract_monitor_alerts_company_id_created_at_idx"
  ON "contract_monitor_alerts"("company_id", "created_at");
CREATE INDEX "contract_monitor_alerts_target_type_target_id_idx"
  ON "contract_monitor_alerts"("target_type", "target_id");
