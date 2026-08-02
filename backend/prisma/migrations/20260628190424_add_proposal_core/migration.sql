-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('RASCUNHO', 'EM_PREENCHIMENTO', 'PENDENTE_DE_DADOS', 'PENDENTE_DE_REVISAO', 'EM_REVISAO', 'AJUSTES_SOLICITADOS', 'APROVADA', 'EXPORTADA', 'SUBMETIDA', 'CANCELADA', 'ARQUIVADA');

-- CreateTable
CREATE TABLE "proposals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "procurement_notice_id" UUID,
    "titulo" TEXT NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'RASCUNHO',
    "moeda" TEXT NOT NULL DEFAULT 'BRL',
    "validade_dias" INTEGER,
    "validade_ate" TIMESTAMPTZ(6),
    "prazo_entrega_dias" INTEGER,
    "condicoes_pagamento" TEXT,
    "garantia" TEXT,
    "observacoes" TEXT,
    "created_by_id" UUID NOT NULL,
    "responsible_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "proposal_id" UUID NOT NULL,
    "procurement_item_id" UUID,
    "codigo" TEXT,
    "numero" TEXT,
    "descricao" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "quantidade" DECIMAL(18,4) NOT NULL,
    "marca" TEXT,
    "modelo" TEXT,
    "custo_unitario" DECIMAL(18,4),
    "preco_unitario_proposto" DECIMAL(18,4),
    "preco_total_proposto" DECIMAL(18,2),
    "margem_percentual" DECIMAL(5,2),
    "posicao" INTEGER NOT NULL,
    "observacoes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proposals_company_id_status_idx" ON "proposals"("company_id", "status");

-- CreateIndex
CREATE INDEX "proposals_company_id_updated_at_idx" ON "proposals"("company_id", "updated_at");

-- CreateIndex
CREATE INDEX "proposals_procurement_notice_id_idx" ON "proposals"("procurement_notice_id");

-- CreateIndex
CREATE INDEX "proposals_created_by_id_idx" ON "proposals"("created_by_id");

-- CreateIndex
CREATE INDEX "proposals_responsible_user_id_idx" ON "proposals"("responsible_user_id");

-- CreateIndex
CREATE INDEX "proposal_items_proposal_id_idx" ON "proposal_items"("proposal_id");

-- CreateIndex
CREATE INDEX "proposal_items_proposal_id_posicao_idx" ON "proposal_items"("proposal_id", "posicao");

-- CreateIndex
CREATE INDEX "proposal_items_procurement_item_id_idx" ON "proposal_items"("procurement_item_id");

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_procurement_notice_id_fkey" FOREIGN KEY ("procurement_notice_id") REFERENCES "procurement_notices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "proposal_items" ADD CONSTRAINT "proposal_items_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
