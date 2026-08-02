CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");
CREATE INDEX "tenants_active_idx" ON "tenants"("active");

ALTER TABLE "users" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "companies" ADD COLUMN "tenant_id" UUID;

-- Cada conta existente recebe um workspace próprio. O UUID do usuário é
-- reutilizado para tornar o backfill determinístico e idempotente.
INSERT INTO "tenants" ("id", "name", "slug")
SELECT
    "id",
    COALESCE(NULLIF(BTRIM("nome"), ''), "email"),
    'workspace-' || "id"::text
FROM "users";

UPDATE "users"
SET "tenant_id" = "id";

UPDATE "companies" AS company
SET "tenant_id" = app_user."tenant_id"
FROM "users" AS app_user
WHERE company."user_id" = app_user."id";

ALTER TABLE "users" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "companies" ALTER COLUMN "tenant_id" SET NOT NULL;

CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");
CREATE INDEX "companies_tenant_id_idx" ON "companies"("tenant_id");
CREATE UNIQUE INDEX "companies_tenant_id_cnpj_key" ON "companies"("tenant_id", "cnpj");

ALTER TABLE "users"
ADD CONSTRAINT "users_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "companies"
ADD CONSTRAINT "companies_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
ON DELETE RESTRICT ON UPDATE NO ACTION;
