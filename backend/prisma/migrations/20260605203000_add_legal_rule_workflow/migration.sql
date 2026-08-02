ALTER TABLE "legal_rules"
  ADD COLUMN IF NOT EXISTS "workflow_status" TEXT,
  ADD COLUMN IF NOT EXISTS "created_by_id" TEXT,
  ADD COLUMN IF NOT EXISTS "submitted_by_id" TEXT,
  ADD COLUMN IF NOT EXISTS "approved_by_id" TEXT,
  ADD COLUMN IF NOT EXISTS "rejected_by_id" TEXT,
  ADD COLUMN IF NOT EXISTS "activated_by_id" TEXT,
  ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "activated_at" TIMESTAMPTZ(6);

UPDATE "legal_rules"
SET "workflow_status" = CASE WHEN "active" = true THEN 'active' ELSE 'inactive' END
WHERE "workflow_status" IS NULL;

ALTER TABLE "legal_rules"
  ALTER COLUMN "workflow_status" SET NOT NULL,
  ALTER COLUMN "workflow_status" SET DEFAULT 'draft';

CREATE INDEX IF NOT EXISTS "legal_rules_workflow_status_idx" ON "legal_rules"("workflow_status");

INSERT INTO "permissions" ("key", "module", "action", "scope", "description", "system")
VALUES
  ('legal:review', 'legal', 'review', 'module', 'Aprovar ou rejeitar regras juridicas em revisao.', true),
  ('legal:publish', 'legal', 'publish', 'module', 'Ativar regras juridicas aprovadas para uso em producao.', true)
ON CONFLICT ("key") DO UPDATE SET
  "module" = EXCLUDED."module",
  "action" = EXCLUDED."action",
  "scope" = EXCLUDED."scope",
  "description" = EXCLUDED."description",
  "system" = true,
  "updated_at" = CURRENT_TIMESTAMP;

WITH seed_roles("key", "name", "description", "scope", "module", "system", "active") AS (
  VALUES
  ('legal_reviewer', 'Legal Reviewer', 'Revisa, aprova e rejeita regras juridicas.', 'module', 'legal', true, true),
  ('legal_publisher', 'Legal Publisher', 'Publica regras juridicas aprovadas em producao.', 'module', 'legal', true, true)
)
INSERT INTO "roles" ("key", "name", "description", "scope", "module", "system", "active")
SELECT sr."key", sr."name", sr."description", sr."scope", sr."module", sr."system", sr."active"
FROM seed_roles sr
WHERE NOT EXISTS (
  SELECT 1
  FROM "roles" r
  WHERE r."key" = sr."key"
    AND r."tenant_id" IS NULL
    AND r."module" = sr."module"
);

WITH seed_roles("key", "name", "description", "scope", "module") AS (
  VALUES
  ('legal_reviewer', 'Legal Reviewer', 'Revisa, aprova e rejeita regras juridicas.', 'module', 'legal'),
  ('legal_publisher', 'Legal Publisher', 'Publica regras juridicas aprovadas em producao.', 'module', 'legal')
)
UPDATE "roles" r
SET
  "name" = sr."name",
  "description" = sr."description",
  "scope" = sr."scope",
  "system" = true,
  "active" = true,
  "updated_at" = CURRENT_TIMESTAMP
FROM seed_roles sr
WHERE r."key" = sr."key"
  AND r."tenant_id" IS NULL
  AND r."module" = sr."module";

WITH role_permission_map(role_key, permission_key) AS (
  VALUES
    ('platform_owner', 'legal:review'),
    ('platform_owner', 'legal:publish'),
    ('legal_reviewer', 'legal:review'),
    ('legal_publisher', 'legal:publish')
)
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM role_permission_map rpm
JOIN "roles" r ON r."key" = rpm.role_key AND r."tenant_id" IS NULL
JOIN "permissions" p ON p."key" = rpm.permission_key
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
