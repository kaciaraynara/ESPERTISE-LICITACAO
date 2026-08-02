INSERT INTO "permissions" ("key", "module", "action", "scope", "description", "system")
VALUES
  ('audit:export', 'audit', 'export', 'module', 'Preparar autorizacao para exportacao futura de eventos de auditoria.', true)
ON CONFLICT ("key") DO UPDATE SET
  "module" = EXCLUDED."module",
  "action" = EXCLUDED."action",
  "scope" = EXCLUDED."scope",
  "description" = EXCLUDED."description",
  "system" = true,
  "updated_at" = CURRENT_TIMESTAMP;

WITH role_permission_map(role_key, permission_key) AS (
  VALUES
    ('platform_owner', 'audit:export'),
    ('audit_admin', 'audit:export')
)
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM role_permission_map rpm
JOIN "roles" r ON r."key" = rpm.role_key AND r."tenant_id" IS NULL
JOIN "permissions" p ON p."key" = rpm.permission_key
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
