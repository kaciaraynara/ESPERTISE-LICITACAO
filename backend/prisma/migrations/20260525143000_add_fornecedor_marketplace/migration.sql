-- CreateTable
CREATE TABLE "fornecedores_marketplace" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_user_id" UUID,
    "cnpj" TEXT NOT NULL,
    "razao_social" TEXT NOT NULL,
    "nome_fantasia" TEXT,
    "cnae_principal" TEXT NOT NULL,
    "ramo_atividade" TEXT NOT NULL,
    "regiao_atendimento" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "municipio" TEXT,
    "uf" TEXT,
    "nota_reputacao" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "selos_conformidade" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "custo_referencia" DECIMAL(14,2),
    "unidade_custo" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fornecedores_marketplace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fornecedores_marketplace_cnpj_key" ON "fornecedores_marketplace"("cnpj");

-- CreateIndex
CREATE INDEX "fornecedores_marketplace_owner_user_id_idx" ON "fornecedores_marketplace"("owner_user_id");

-- CreateIndex
CREATE INDEX "fornecedores_marketplace_cnae_principal_idx" ON "fornecedores_marketplace"("cnae_principal");

-- CreateIndex
CREATE INDEX "fornecedores_marketplace_uf_idx" ON "fornecedores_marketplace"("uf");

-- AddForeignKey
ALTER TABLE "fornecedores_marketplace" ADD CONSTRAINT "fornecedores_marketplace_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
