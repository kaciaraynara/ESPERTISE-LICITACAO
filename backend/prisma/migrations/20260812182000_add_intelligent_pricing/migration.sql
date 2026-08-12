-- CreateEnum
CREATE TYPE "DataSourceStatus" AS ENUM ('ACTIVE', 'STALE', 'INVALID', 'UNAVAILABLE', 'PENDING_REVIEW');

-- CreateEnum
CREATE TYPE "DataSourceType" AS ENUM ('GOVERNMENT', 'PUBLIC_API', 'OFFICIAL_DOCUMENT', 'MARKETPLACE', 'INTERNAL');

-- CreateEnum
CREATE TYPE "PriceObservationStatus" AS ENUM ('ACTIVE', 'STALE', 'INVALID', 'PENDING_REVIEW');

-- CreateEnum
CREATE TYPE "PriceAnalysisConfidence" AS ENUM ('VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH');

-- CreateTable
CREATE TABLE "data_sources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DataSourceType" NOT NULL,
    "authority" TEXT,
    "base_url" TEXT,
    "api_url" TEXT,
    "verification_url" TEXT,
    "status" "DataSourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "trust_level" INTEGER NOT NULL DEFAULT 100,
    "update_frequency" TEXT,
    "last_success_at" TIMESTAMPTZ(6),
    "last_failure_at" TIMESTAMPTZ(6),
    "last_failure_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_observations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_id" UUID NOT NULL,
    "external_id" TEXT,
    "procurement_notice_id" UUID,
    "procurement_item_id" UUID,
    "supplier_id" UUID,
    "description_original" TEXT NOT NULL,
    "description_normalized" TEXT NOT NULL,
    "catalog_code" TEXT,
    "unit" TEXT,
    "quantity" DECIMAL(18,4),
    "unit_price" DECIMAL(18,6) NOT NULL,
    "total_price" DECIMAL(18,2),
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "uf" TEXT,
    "municipality" TEXT,
    "published_at" TIMESTAMPTZ(6),
    "observed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_url" TEXT,
    "raw_payload" JSONB,
    "content_hash" TEXT,
    "status" "PriceObservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_analyses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "procurement_notice_id" UUID,
    "procurement_item_id" UUID,
    "catalog_code" TEXT,
    "sample_size" INTEGER NOT NULL,
    "source_count" INTEGER NOT NULL,
    "minimum_price" DECIMAL(18,6),
    "maximum_price" DECIMAL(18,6),
    "mean_price" DECIMAL(18,6),
    "median_price" DECIMAL(18,6),
    "p25_price" DECIMAL(18,6),
    "p75_price" DECIMAL(18,6),
    "reference_price" DECIMAL(18,6),
    "competitive_min_price" DECIMAL(18,6),
    "competitive_max_price" DECIMAL(18,6),
    "target_price" DECIMAL(18,6),
    "minimum_healthy_price" DECIMAL(18,6),
    "confidence" "PriceAnalysisConfidence" NOT NULL,
    "methodology_version" TEXT NOT NULL,
    "outlier_count" INTEGER NOT NULL DEFAULT 0,
    "outlier_details" JSONB,
    "source_details" JSONB,
    "analyzed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "data_sources_key_key" ON "data_sources"("key");

-- CreateIndex
CREATE INDEX "data_sources_status_idx" ON "data_sources"("status");

-- CreateIndex
CREATE INDEX "data_sources_type_idx" ON "data_sources"("type");

-- CreateIndex
CREATE INDEX "data_sources_authority_idx" ON "data_sources"("authority");

-- CreateIndex
CREATE INDEX "price_observations_source_id_idx" ON "price_observations"("source_id");

-- CreateIndex
CREATE INDEX "price_observations_external_id_idx" ON "price_observations"("external_id");

-- CreateIndex
CREATE INDEX "price_observations_catalog_code_idx" ON "price_observations"("catalog_code");

-- CreateIndex
CREATE INDEX "price_observations_supplier_id_idx" ON "price_observations"("supplier_id");

-- CreateIndex
CREATE INDEX "price_observations_procurement_notice_id_idx" ON "price_observations"("procurement_notice_id");

-- CreateIndex
CREATE INDEX "price_observations_procurement_item_id_idx" ON "price_observations"("procurement_item_id");

-- CreateIndex
CREATE INDEX "price_observations_uf_idx" ON "price_observations"("uf");

-- CreateIndex
CREATE INDEX "price_observations_municipality_idx" ON "price_observations"("municipality");

-- CreateIndex
CREATE INDEX "price_observations_status_idx" ON "price_observations"("status");

-- CreateIndex
CREATE INDEX "price_observations_observed_at_idx" ON "price_observations"("observed_at");

-- CreateIndex
CREATE INDEX "price_analyses_procurement_notice_id_idx" ON "price_analyses"("procurement_notice_id");

-- CreateIndex
CREATE INDEX "price_analyses_procurement_item_id_idx" ON "price_analyses"("procurement_item_id");

-- CreateIndex
CREATE INDEX "price_analyses_catalog_code_idx" ON "price_analyses"("catalog_code");

-- CreateIndex
CREATE INDEX "price_analyses_analyzed_at_idx" ON "price_analyses"("analyzed_at");

-- AddForeignKey
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "data_sources"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
