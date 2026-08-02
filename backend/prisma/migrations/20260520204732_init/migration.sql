-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('fornecedor', 'advogado', 'contador');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('nova_oportunidade', 'score_alto', 'prazo_proximo', 'licitacao_encerrada', 'sistema', 'empresa_configurada');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('pendente', 'enviada', 'falha');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'canceled', 'past_due', 'trialing');

-- CreateEnum
CREATE TYPE "SubscriptionCategory" AS ENUM ('plataforma', 'juridico');

-- CreateEnum
CREATE TYPE "StripeWebhookEventStatus" AS ENUM ('processing', 'processed', 'failed');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('valido', 'atencao', 'vencido');

-- CreateEnum
CREATE TYPE "LawyerStatus" AS ENUM ('ativo', 'analise', 'pausado');

-- CreateEnum
CREATE TYPE "LegalCaseStatus" AS ENUM ('novo', 'em_andamento', 'concluido');

-- CreateEnum
CREATE TYPE "LegalMessageSenderType" AS ENUM ('cliente', 'advogado');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "email_normalized" TEXT NOT NULL,
    "nome" TEXT,
    "telefone" TEXT,
    "plano" TEXT NOT NULL DEFAULT 'free',
    "email_verificado" BOOLEAN NOT NULL DEFAULT false,
    "ultimo_acesso" TIMESTAMPTZ(6),
    "password_hash" TEXT NOT NULL,
    "aceite_lgpd" BOOLEAN NOT NULL DEFAULT false,
    "role" "UserRole" NOT NULL DEFAULT 'fornecedor',
    "oab_numero" TEXT,
    "oab_uf" TEXT,
    "crc_numero" TEXT,
    "crc_uf" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "cnpj" TEXT NOT NULL,
    "razao_social" TEXT NOT NULL,
    "nome_fantasia" TEXT,
    "cnae_principal" TEXT,
    "municipio" TEXT,
    "uf" TEXT,
    "status" TEXT,
    "nicho" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "palavras_chave" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "valor_min" DECIMAL(14,2),
    "valor_max" DECIMAL(14,2),
    "regioes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "orgaos_preferidos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "orgaos_bloqueados" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "last_used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "company_id" UUID,
    "tipo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "validade" TIMESTAMPTZ(6),
    "status" "DocumentStatus" NOT NULL DEFAULT 'valido',
    "url" TEXT,
    "arquivo_nome" TEXT,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "tipo" "NotificationType" NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "canal" TEXT NOT NULL DEFAULT 'painel',
    "status" "NotificationStatus" NOT NULL DEFAULT 'enviada',
    "enviada_em" TIMESTAMPTZ(6),
    "licitacao_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "plano" TEXT NOT NULL,
    "categoria" "SubscriptionCategory" NOT NULL DEFAULT 'plataforma',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'trialing',
    "periodo_inicio" TIMESTAMPTZ(6) NOT NULL,
    "periodo_fim" TIMESTAMPTZ(6) NOT NULL,
    "cancelar_ao_fim" BOOLEAN NOT NULL DEFAULT false,
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "stripe_price_id" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_webhook_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "StripeWebhookEventStatus" NOT NULL DEFAULT 'processing',
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "last_error" TEXT,
    "processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licitacoes_cache" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "numero_controle_pncp" TEXT NOT NULL,
    "objeto" TEXT,
    "cnpj_orgao" TEXT,
    "razao_social_orgao" TEXT,
    "uf" TEXT,
    "municipio" TEXT,
    "valor_estimado" DECIMAL(16,2),
    "data_publicacao" TIMESTAMPTZ(6),
    "data_abertura" TIMESTAMPTZ(6),
    "data_encerramento" TIMESTAMPTZ(6),
    "modalidade" TEXT,
    "situacao" TEXT,
    "link" TEXT,
    "fonte" TEXT NOT NULL DEFAULT 'PNCP',
    "srp" BOOLEAN NOT NULL DEFAULT false,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "licitacoes_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_cache_transparencia" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_cache_transparencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "juridico" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "nome_exibicao" TEXT NOT NULL,
    "oab_numero" TEXT NOT NULL,
    "oab_uf" TEXT NOT NULL,
    "especialidades" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cidade" TEXT,
    "uf" TEXT,
    "bio" TEXT,
    "contato_publico" TEXT,
    "plano_mensal" TEXT NOT NULL,
    "status" "LawyerStatus" NOT NULL DEFAULT 'analise',
    "casos_ativos" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "juridico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "juridico_cases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_user_id" UUID NOT NULL,
    "lawyer_user_id" UUID NOT NULL,
    "assunto" TEXT NOT NULL,
    "edital_id" TEXT,
    "edital_objeto" TEXT,
    "descricao" TEXT NOT NULL,
    "telefone_cliente" TEXT,
    "status" "LegalCaseStatus" NOT NULL DEFAULT 'novo',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "juridico_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "juridico_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "case_id" UUID NOT NULL,
    "sender_user_id" UUID NOT NULL,
    "sender_tipo" "LegalMessageSenderType" NOT NULL,
    "sender_nome" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "juridico_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "juridico_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "case_id" UUID NOT NULL,
    "lawyer_user_id" UUID NOT NULL,
    "client_user_id" UUID NOT NULL,
    "nota" INTEGER NOT NULL,
    "comentario" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "juridico_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_user_id" UUID NOT NULL,
    "nome_comercial" TEXT NOT NULL,
    "descricao_original" TEXT NOT NULL,
    "preco_unitario" DECIMAL(14,2) NOT NULL,
    "unidade" TEXT NOT NULL,
    "ncm" TEXT,
    "segmento_macro" TEXT NOT NULL,
    "fornecedor_dados" JSONB NOT NULL,
    "score_licitacao" INTEGER NOT NULL,
    "origem_dado" TEXT NOT NULL,
    "palavras_chave" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_normalized_key" ON "users"("email_normalized");

-- CreateIndex
CREATE INDEX "companies_user_id_idx" ON "companies"("user_id");

-- CreateIndex
CREATE INDEX "companies_uf_idx" ON "companies"("uf");

-- CreateIndex
CREATE UNIQUE INDEX "companies_user_id_cnpj_key" ON "companies"("user_id", "cnpj");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_user_id_token_hash_key" ON "refresh_tokens"("user_id", "token_hash");

-- CreateIndex
CREATE INDEX "documents_user_id_idx" ON "documents"("user_id");

-- CreateIndex
CREATE INDEX "documents_company_id_idx" ON "documents"("company_id");

-- CreateIndex
CREATE INDEX "documents_validade_idx" ON "documents"("validade");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "notifications_user_lida_idx" ON "notifications"("user_id", "lida");

-- CreateIndex
CREATE INDEX "subscriptions_email_idx" ON "subscriptions"("email");

-- CreateIndex
CREATE INDEX "subscriptions_stripe_customer_id_idx" ON "subscriptions"("stripe_customer_id");

-- CreateIndex
CREATE INDEX "subscriptions_stripe_subscription_id_idx" ON "subscriptions"("stripe_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_user_id_categoria_key" ON "subscriptions"("user_id", "categoria");

-- CreateIndex
CREATE INDEX "stripe_webhook_events_status_idx" ON "stripe_webhook_events"("status");

-- CreateIndex
CREATE UNIQUE INDEX "licitacoes_cache_numero_controle_pncp_key" ON "licitacoes_cache"("numero_controle_pncp");

-- CreateIndex
CREATE INDEX "licitacoes_cache_uf_idx" ON "licitacoes_cache"("uf");

-- CreateIndex
CREATE INDEX "licitacoes_cache_data_publicacao_idx" ON "licitacoes_cache"("data_publicacao");

-- CreateIndex
CREATE INDEX "licitacoes_cache_atualizado_em_idx" ON "licitacoes_cache"("atualizado_em");

-- CreateIndex
CREATE UNIQUE INDEX "api_cache_transparencia_chave_key" ON "api_cache_transparencia"("chave");

-- CreateIndex
CREATE INDEX "api_cache_transparencia_expires_at_idx" ON "api_cache_transparencia"("expires_at");

-- CreateIndex
CREATE INDEX "api_cache_transparencia_endpoint_idx" ON "api_cache_transparencia"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "juridico_user_id_key" ON "juridico"("user_id");

-- CreateIndex
CREATE INDEX "juridico_uf_idx" ON "juridico"("uf");

-- CreateIndex
CREATE UNIQUE INDEX "juridico_oab_numero_oab_uf_key" ON "juridico"("oab_numero", "oab_uf");

-- CreateIndex
CREATE INDEX "juridico_cases_client_user_id_idx" ON "juridico_cases"("client_user_id");

-- CreateIndex
CREATE INDEX "juridico_cases_lawyer_user_id_idx" ON "juridico_cases"("lawyer_user_id");

-- CreateIndex
CREATE INDEX "juridico_cases_status_idx" ON "juridico_cases"("status");

-- CreateIndex
CREATE INDEX "juridico_messages_case_created_idx" ON "juridico_messages"("case_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "juridico_reviews_case_id_key" ON "juridico_reviews"("case_id");

-- CreateIndex
CREATE INDEX "juridico_reviews_lawyer_user_id_idx" ON "juridico_reviews"("lawyer_user_id");

-- CreateIndex
CREATE INDEX "juridico_reviews_client_user_id_idx" ON "juridico_reviews"("client_user_id");

-- CreateIndex
CREATE INDEX "marketplace_owner_user_id_idx" ON "marketplace"("owner_user_id");

-- CreateIndex
CREATE INDEX "marketplace_segmento_macro_idx" ON "marketplace"("segmento_macro");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "juridico" ADD CONSTRAINT "juridico_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "juridico_cases" ADD CONSTRAINT "juridico_cases_client_user_id_fkey" FOREIGN KEY ("client_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "juridico_cases" ADD CONSTRAINT "juridico_cases_lawyer_user_id_fkey" FOREIGN KEY ("lawyer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "juridico_messages" ADD CONSTRAINT "juridico_messages_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "juridico_cases"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "juridico_messages" ADD CONSTRAINT "juridico_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "juridico_reviews" ADD CONSTRAINT "juridico_reviews_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "juridico_cases"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "marketplace" ADD CONSTRAINT "marketplace_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
