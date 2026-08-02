ALTER TABLE "users"
ADD COLUMN "deleted_at" TIMESTAMPTZ(6),
ADD COLUMN "anonymized_at" TIMESTAMPTZ(6);

CREATE INDEX "users_deleted_at_anonymized_at_idx"
ON "users"("deleted_at", "anonymized_at");

CREATE TABLE "api_rate_limit_buckets" (
  "key" TEXT NOT NULL,
  "hits" INTEGER NOT NULL DEFAULT 0,
  "reset_at" TIMESTAMPTZ(6) NOT NULL,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "api_rate_limit_buckets_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "api_rate_limit_buckets_reset_at_idx"
ON "api_rate_limit_buckets"("reset_at");
