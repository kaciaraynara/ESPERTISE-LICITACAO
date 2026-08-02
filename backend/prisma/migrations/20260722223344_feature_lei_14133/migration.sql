/*
  Warnings:

  - You are about to drop the column `stripe_customer_id` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `stripe_price_id` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `stripe_subscription_id` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the `stripe_webhook_events` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('processing', 'processed', 'failed');

-- CreateEnum
CREATE TYPE "ProcurementModality" AS ENUM ('pregao', 'concorrencia', 'concurso', 'leilao', 'dialogo_competitivo', 'dispensa', 'inexigibilidade');

-- CreateEnum
CREATE TYPE "JudgmentCriterion" AS ENUM ('menor_preco', 'maior_desconto', 'melhor_tecnica', 'tecnica_e_preco', 'maior_lance', 'maior_retorno_economico');

-- CreateEnum
CREATE TYPE "ExecutionRegime" AS ENUM ('preco_unitario', 'preco_global', 'tarefa', 'integrada', 'semi_integrada', 'fornecimento_continuo');

-- CreateEnum
CREATE TYPE "ProcurementEventType" AS ENUM ('question', 'impugnation', 'appeal');

-- DropIndex
DROP INDEX "subscriptions_stripe_customer_id_idx";

-- DropIndex
DROP INDEX "subscriptions_stripe_subscription_id_idx";

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "impedimento_detalhes" TEXT,
ADD COLUMN     "impedimento_licitacao" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "procurement_notices" ADD COLUMN     "exclusive_me_epp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "execution_regime" "ExecutionRegime",
ADD COLUMN     "judgment_criterion" "JudgmentCriterion",
ADD COLUMN     "modality_enum" "ProcurementModality";

-- AlterTable
ALTER TABLE "proposal_items" ADD COLUMN     "catalogo_codigo" TEXT,
ADD COLUMN     "catalogo_preco_referencia" DECIMAL(18,4);

-- AlterTable
ALTER TABLE "subscriptions" DROP COLUMN "stripe_customer_id",
DROP COLUMN "stripe_price_id",
DROP COLUMN "stripe_subscription_id",
ADD COLUMN     "mp_payer_id" TEXT,
ADD COLUMN     "mp_plan_id" TEXT,
ADD COLUMN     "mp_preapproval_id" TEXT;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "impedimento_detalhes" TEXT,
ADD COLUMN     "impedimento_licitacao" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "stripe_webhook_events";

-- DropEnum
DROP TYPE "StripeWebhookEventStatus";

-- CreateTable
CREATE TABLE "mercadopago_webhook_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'processing',
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "last_error" TEXT,
    "processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mercadopago_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_lots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT,
    "procurement_notice_id" UUID NOT NULL,
    "lot_number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "estimated_value" DECIMAL(18,2),
    "status" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procurement_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT,
    "procurement_notice_id" UUID NOT NULL,
    "lot_id" UUID,
    "item_number" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,4),
    "unit" TEXT,
    "estimated_unit_value" DECIMAL(18,4),
    "estimated_total_value" DECIMAL(18,2),
    "brand_reference" BOOLEAN NOT NULL DEFAULT false,
    "catalogo_codigo" TEXT,
    "catalogo_preco_referencia" DECIMAL(18,4),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procurement_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT,
    "procurement_notice_id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "external_id" TEXT,
    "attachment_type" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "mime_type" TEXT,
    "content_hash" TEXT,
    "extracted_text" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procurement_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_requirements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT,
    "procurement_notice_id" UUID NOT NULL,
    "requirement_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "detected_from" TEXT,
    "evidence_chunk_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procurement_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "procurement_notice_id" UUID NOT NULL,
    "event_type" "ProcurementEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'filed',
    "filed_at" TIMESTAMPTZ(6) NOT NULL,
    "deadline_at" TIMESTAMPTZ(6),
    "responded_at" TIMESTAMPTZ(6),
    "response_text" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procurement_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "government_catalog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "catalog_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT,
    "reference_price" DECIMAL(18,4),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "government_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "template_type" TEXT NOT NULL,
    "content_template" TEXT NOT NULL,
    "merge_tags" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mercadopago_webhook_events_status_idx" ON "mercadopago_webhook_events"("status");

-- CreateIndex
CREATE INDEX "procurement_lots_tenant_id_idx" ON "procurement_lots"("tenant_id");

-- CreateIndex
CREATE INDEX "procurement_lots_procurement_notice_id_idx" ON "procurement_lots"("procurement_notice_id");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_lots_procurement_notice_id_lot_number_key" ON "procurement_lots"("procurement_notice_id", "lot_number");

-- CreateIndex
CREATE INDEX "procurement_items_tenant_id_idx" ON "procurement_items"("tenant_id");

-- CreateIndex
CREATE INDEX "procurement_items_procurement_notice_id_idx" ON "procurement_items"("procurement_notice_id");

-- CreateIndex
CREATE INDEX "procurement_items_lot_id_idx" ON "procurement_items"("lot_id");

-- CreateIndex
CREATE INDEX "procurement_items_brand_reference_idx" ON "procurement_items"("brand_reference");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_items_procurement_notice_id_item_number_key" ON "procurement_items"("procurement_notice_id", "item_number");

-- CreateIndex
CREATE INDEX "procurement_attachments_tenant_id_idx" ON "procurement_attachments"("tenant_id");

-- CreateIndex
CREATE INDEX "procurement_attachments_procurement_notice_id_idx" ON "procurement_attachments"("procurement_notice_id");

-- CreateIndex
CREATE INDEX "procurement_attachments_attachment_type_idx" ON "procurement_attachments"("attachment_type");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_attachments_procurement_notice_id_file_url_key" ON "procurement_attachments"("procurement_notice_id", "file_url");

-- CreateIndex
CREATE INDEX "procurement_requirements_tenant_id_idx" ON "procurement_requirements"("tenant_id");

-- CreateIndex
CREATE INDEX "procurement_requirements_procurement_notice_id_idx" ON "procurement_requirements"("procurement_notice_id");

-- CreateIndex
CREATE INDEX "procurement_requirements_requirement_type_idx" ON "procurement_requirements"("requirement_type");

-- CreateIndex
CREATE INDEX "procurement_requirements_mandatory_idx" ON "procurement_requirements"("mandatory");

-- CreateIndex
CREATE INDEX "procurement_events_procurement_notice_id_idx" ON "procurement_events"("procurement_notice_id");

-- CreateIndex
CREATE INDEX "procurement_events_event_type_idx" ON "procurement_events"("event_type");

-- CreateIndex
CREATE UNIQUE INDEX "government_catalog_code_key" ON "government_catalog"("code");

-- CreateIndex
CREATE INDEX "government_catalog_catalog_type_idx" ON "government_catalog"("catalog_type");

-- CreateIndex
CREATE INDEX "document_templates_tenant_id_idx" ON "document_templates"("tenant_id");

-- CreateIndex
CREATE INDEX "document_templates_template_type_idx" ON "document_templates"("template_type");

-- CreateIndex
CREATE INDEX "subscriptions_mp_payer_id_idx" ON "subscriptions"("mp_payer_id");

-- CreateIndex
CREATE INDEX "subscriptions_mp_preapproval_id_idx" ON "subscriptions"("mp_preapproval_id");

-- AddForeignKey
ALTER TABLE "procurement_lots" ADD CONSTRAINT "procurement_lots_procurement_notice_id_fkey" FOREIGN KEY ("procurement_notice_id") REFERENCES "procurement_notices"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "procurement_items" ADD CONSTRAINT "procurement_items_procurement_notice_id_fkey" FOREIGN KEY ("procurement_notice_id") REFERENCES "procurement_notices"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "procurement_items" ADD CONSTRAINT "procurement_items_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "procurement_lots"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "procurement_attachments" ADD CONSTRAINT "procurement_attachments_procurement_notice_id_fkey" FOREIGN KEY ("procurement_notice_id") REFERENCES "procurement_notices"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "procurement_requirements" ADD CONSTRAINT "procurement_requirements_procurement_notice_id_fkey" FOREIGN KEY ("procurement_notice_id") REFERENCES "procurement_notices"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "procurement_requirements" ADD CONSTRAINT "procurement_requirements_evidence_chunk_id_fkey" FOREIGN KEY ("evidence_chunk_id") REFERENCES "document_chunks"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "procurement_events" ADD CONSTRAINT "procurement_events_procurement_notice_id_fkey" FOREIGN KEY ("procurement_notice_id") REFERENCES "procurement_notices"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- RenameIndex
ALTER INDEX "ai_retrieval_sessions_tenant_created_at_idx" RENAME TO "ai_retrieval_sessions_tenant_id_created_at_idx";

-- RenameIndex
ALTER INDEX "ai_runs_tenant_created_at_idx" RENAME TO "ai_runs_tenant_id_created_at_idx";

-- RenameIndex
ALTER INDEX "ai_runs_user_created_at_idx" RENAME TO "ai_runs_user_id_created_at_idx";

-- RenameIndex
ALTER INDEX "legal_analyses_tenant_created_at_idx" RENAME TO "legal_analyses_tenant_id_created_at_idx";

-- RenameIndex
ALTER INDEX "legal_analyses_user_created_at_idx" RENAME TO "legal_analyses_user_id_created_at_idx";
