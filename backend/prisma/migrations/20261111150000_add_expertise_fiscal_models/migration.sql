-- CreateTable: company_addon_subscriptions
CREATE TABLE "company_addon_subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "addon_slug" TEXT NOT NULL DEFAULT 'expertise_fiscal',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "price_cents" INTEGER NOT NULL DEFAULT 9999,
    "activated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_addon_subscriptions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "company_addon_subscriptions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX "company_addon_subscriptions_company_id_addon_slug_key" ON "company_addon_subscriptions"("company_id", "addon_slug");
CREATE INDEX "company_addon_subscriptions_tenant_id_idx" ON "company_addon_subscriptions"("tenant_id");
CREATE INDEX "company_addon_subscriptions_company_id_idx" ON "company_addon_subscriptions"("company_id");
CREATE INDEX "company_addon_subscriptions_addon_slug_idx" ON "company_addon_subscriptions"("addon_slug");
CREATE INDEX "company_addon_subscriptions_status_idx" ON "company_addon_subscriptions"("status");

-- CreateTable: tax_rule_versions
CREATE TABLE "tax_rule_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rule_code" TEXT NOT NULL,
    "tax_name" TEXT NOT NULL,
    "tax_regime" TEXT NOT NULL,
    "operation_type" TEXT NOT NULL,
    "cnae_prefix" TEXT,
    "ncm_code" TEXT,
    "rate_percent" DECIMAL(8,4) NOT NULL,
    "reducer_percent" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "allows_credit" BOOLEAN NOT NULL DEFAULT false,
    "credit_rules_json" JSONB DEFAULT '{}',
    "legal_basis" TEXT NOT NULL,
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_to" TIMESTAMPTZ(6),
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "changelog" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_rule_versions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tax_rule_versions_rule_code_idx" ON "tax_rule_versions"("rule_code");
CREATE INDEX "tax_rule_versions_tax_name_idx" ON "tax_rule_versions"("tax_name");
CREATE INDEX "tax_rule_versions_tax_regime_idx" ON "tax_rule_versions"("tax_regime");
CREATE INDEX "tax_rule_versions_operation_type_idx" ON "tax_rule_versions"("operation_type");
CREATE INDEX "tax_rule_versions_effective_from_effective_to_idx" ON "tax_rule_versions"("effective_from", "effective_to");

-- CreateTable: fiscal_document_imports
CREATE TABLE "fiscal_document_imports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "doc_type" TEXT NOT NULL,
    "access_key_or_period" TEXT NOT NULL,
    "file_hash_sha256" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'ENTRADA',
    "issue_date" TIMESTAMPTZ(6) NOT NULL,
    "total_amount" DECIMAL(18,2) NOT NULL,
    "taxes_summary_json" JSONB DEFAULT '{}',
    "parsed_items_json" JSONB DEFAULT '[]',
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_document_imports_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fiscal_document_imports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "fiscal_document_imports_tenant_id_idx" ON "fiscal_document_imports"("tenant_id");
CREATE INDEX "fiscal_document_imports_company_id_idx" ON "fiscal_document_imports"("company_id");
CREATE INDEX "fiscal_document_imports_doc_type_idx" ON "fiscal_document_imports"("doc_type");
CREATE INDEX "fiscal_document_imports_file_hash_sha256_idx" ON "fiscal_document_imports"("file_hash_sha256");
CREATE INDEX "fiscal_document_imports_access_key_or_period_idx" ON "fiscal_document_imports"("access_key_or_period");

-- CreateTable: tax_credit_opportunities
CREATE TABLE "tax_credit_opportunities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "source_document_id" UUID,
    "tax_type" TEXT NOT NULL,
    "origin_category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'POTENTIAL',
    "principal_amount" DECIMAL(18,2) NOT NULL,
    "selic_updated_amount" DECIMAL(18,2) NOT NULL,
    "calculation_memory_json" JSONB NOT NULL,
    "legal_basis" TEXT NOT NULL,
    "is_documented" BOOLEAN NOT NULL DEFAULT false,
    "is_legally_usable" BOOLEAN NOT NULL DEFAULT false,
    "is_available_for_offset" BOOLEAN NOT NULL DEFAULT false,
    "validated_by_professional_name" TEXT,
    "validated_by_registry_crc_oab" TEXT,
    "validated_at" TIMESTAMPTZ(6),
    "perdcomp_protocol" TEXT,
    "used_in_proposal_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_credit_opportunities_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tax_credit_opportunities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "tax_credit_opportunities_tenant_id_idx" ON "tax_credit_opportunities"("tenant_id");
CREATE INDEX "tax_credit_opportunities_company_id_idx" ON "tax_credit_opportunities"("company_id");
CREATE INDEX "tax_credit_opportunities_status_idx" ON "tax_credit_opportunities"("status");
CREATE INDEX "tax_credit_opportunities_origin_category_idx" ON "tax_credit_opportunities"("origin_category");
CREATE INDEX "tax_credit_opportunities_tax_type_idx" ON "tax_credit_opportunities"("tax_type");

-- CreateTable: contract_tax_ledgers
CREATE TABLE "contract_tax_ledgers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "proposal_id" UUID,
    "baseline_tax_load_percent" DECIMAL(8,4) NOT NULL,
    "effective_tax_load_percent" DECIMAL(8,4) NOT NULL,
    "tax_rule_version_id" UUID NOT NULL,
    "financial_impact_amount" DECIMAL(18,2) NOT NULL,
    "rebalance_justified" BOOLEAN NOT NULL DEFAULT false,
    "technical_report_json" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_tax_ledgers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "contract_tax_ledgers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "contract_tax_ledgers_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "contract_tax_ledgers_tax_rule_version_id_fkey" FOREIGN KEY ("tax_rule_version_id") REFERENCES "tax_rule_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE INDEX "contract_tax_ledgers_tenant_id_idx" ON "contract_tax_ledgers"("tenant_id");
CREATE INDEX "contract_tax_ledgers_company_id_idx" ON "contract_tax_ledgers"("company_id");
CREATE INDEX "contract_tax_ledgers_contract_id_idx" ON "contract_tax_ledgers"("contract_id");
CREATE INDEX "contract_tax_ledgers_tax_rule_version_id_idx" ON "contract_tax_ledgers"("tax_rule_version_id");
CREATE INDEX "contract_tax_ledgers_rebalance_justified_idx" ON "contract_tax_ledgers"("rebalance_justified");
