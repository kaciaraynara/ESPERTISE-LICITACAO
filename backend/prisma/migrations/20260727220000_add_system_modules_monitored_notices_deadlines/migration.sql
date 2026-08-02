-- CreateEnum
CREATE TYPE "ModuleStatus" AS ENUM ('AVAILABLE', 'IN_IMPLANTATION', 'INTEGRATION_PENDING', 'HIDDEN', 'DISABLED');

-- CreateEnum
CREATE TYPE "ModuleAccessStatus" AS ENUM ('ENABLED', 'DISABLED', 'BLOCKED_BY_PLAN', 'TRIAL');

-- CreateEnum
CREATE TYPE "DeadlineType" AS ENUM ('CLARIFICATION', 'IMPUGNATION', 'PROPOSAL_SUBMISSION', 'DISPUTE_SESSION', 'APPEAL', 'COUNTER_ARGUMENT', 'CERTIFICATE_EXPIRATION', 'INTERNAL_REVIEW', 'OTHER');

-- CreateEnum
CREATE TYPE "DeadlineStatus" AS ENUM ('OPEN', 'DONE', 'CANCELLED', 'OVERDUE');

-- CreateTable
CREATE TABLE "system_modules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "route" TEXT,
    "icon" TEXT,
    "status" "ModuleStatus" NOT NULL DEFAULT 'IN_IMPLANTATION',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_module_access" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "status" "ModuleAccessStatus" NOT NULL DEFAULT 'ENABLED',
    "enabled_at" TIMESTAMPTZ(6),
    "disabled_at" TIMESTAMPTZ(6),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_module_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_monitored_notices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "procurement_notice_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'monitoring',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_monitored_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deadlines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "procurement_notice_id" UUID,
    "proposal_id" UUID,
    "responsible_user_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "DeadlineType" NOT NULL,
    "status" "DeadlineStatus" NOT NULL DEFAULT 'OPEN',
    "due_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "source" TEXT NOT NULL DEFAULT 'manual',
    "source_reference" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deadlines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "system_modules_key_key" ON "system_modules"("key");

-- CreateIndex
CREATE INDEX "system_modules_status_idx" ON "system_modules"("status");

-- CreateIndex
CREATE INDEX "system_modules_is_visible_sort_order_idx" ON "system_modules"("is_visible", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "company_module_access_company_id_module_id_key" ON "company_module_access"("company_id", "module_id");

-- CreateIndex
CREATE INDEX "company_module_access_company_id_idx" ON "company_module_access"("company_id");

-- CreateIndex
CREATE INDEX "company_module_access_module_id_idx" ON "company_module_access"("module_id");

-- CreateIndex
CREATE INDEX "company_module_access_status_idx" ON "company_module_access"("status");

-- CreateIndex
CREATE UNIQUE INDEX "company_monitored_notices_company_id_procurement_notice_id_key" ON "company_monitored_notices"("company_id", "procurement_notice_id");

-- CreateIndex
CREATE INDEX "company_monitored_notices_company_id_idx" ON "company_monitored_notices"("company_id");

-- CreateIndex
CREATE INDEX "company_monitored_notices_procurement_notice_id_idx" ON "company_monitored_notices"("procurement_notice_id");

-- CreateIndex
CREATE INDEX "company_monitored_notices_user_id_idx" ON "company_monitored_notices"("user_id");

-- CreateIndex
CREATE INDEX "company_monitored_notices_status_idx" ON "company_monitored_notices"("status");

-- CreateIndex
CREATE INDEX "deadlines_company_id_idx" ON "deadlines"("company_id");

-- CreateIndex
CREATE INDEX "deadlines_procurement_notice_id_idx" ON "deadlines"("procurement_notice_id");

-- CreateIndex
CREATE INDEX "deadlines_proposal_id_idx" ON "deadlines"("proposal_id");

-- CreateIndex
CREATE INDEX "deadlines_responsible_user_id_idx" ON "deadlines"("responsible_user_id");

-- CreateIndex
CREATE INDEX "deadlines_type_idx" ON "deadlines"("type");

-- CreateIndex
CREATE INDEX "deadlines_status_idx" ON "deadlines"("status");

-- CreateIndex
CREATE INDEX "deadlines_due_at_idx" ON "deadlines"("due_at");

-- AddForeignKey
ALTER TABLE "company_module_access" ADD CONSTRAINT "company_module_access_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "company_module_access" ADD CONSTRAINT "company_module_access_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "system_modules"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "company_monitored_notices" ADD CONSTRAINT "company_monitored_notices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "company_monitored_notices" ADD CONSTRAINT "company_monitored_notices_procurement_notice_id_fkey" FOREIGN KEY ("procurement_notice_id") REFERENCES "procurement_notices"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "company_monitored_notices" ADD CONSTRAINT "company_monitored_notices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_procurement_notice_id_fkey" FOREIGN KEY ("procurement_notice_id") REFERENCES "procurement_notices"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
