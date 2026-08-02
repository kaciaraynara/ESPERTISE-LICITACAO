CREATE TABLE IF NOT EXISTS "roles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "scope" TEXT NOT NULL DEFAULT 'global',
  "tenant_id" TEXT,
  "module" TEXT,
  "system" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "permissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'module',
  "description" TEXT,
  "system" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "user_roles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "role_id" UUID NOT NULL,
  "tenant_id" TEXT,
  "module" TEXT,
  "assigned_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6),
  CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "role_permissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "role_id" UUID NOT NULL,
  "permission_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "roles_key_tenant_id_module_key" ON "roles"("key", "tenant_id", "module");
CREATE UNIQUE INDEX IF NOT EXISTS "roles_key_global_unique" ON "roles"("key") WHERE "tenant_id" IS NULL AND "module" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "roles_key_module_global_unique" ON "roles"("key", "module") WHERE "tenant_id" IS NULL AND "module" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "roles_key_tenant_global_module_unique" ON "roles"("key", "tenant_id") WHERE "tenant_id" IS NOT NULL AND "module" IS NULL;
CREATE INDEX IF NOT EXISTS "roles_tenant_id_idx" ON "roles"("tenant_id");
CREATE INDEX IF NOT EXISTS "roles_module_idx" ON "roles"("module");
CREATE INDEX IF NOT EXISTS "roles_scope_idx" ON "roles"("scope");

CREATE UNIQUE INDEX IF NOT EXISTS "permissions_key_key" ON "permissions"("key");
CREATE INDEX IF NOT EXISTS "permissions_module_idx" ON "permissions"("module");
CREATE INDEX IF NOT EXISTS "permissions_scope_idx" ON "permissions"("scope");

CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_user_id_role_id_tenant_id_module_key" ON "user_roles"("user_id", "role_id", "tenant_id", "module");
CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_global_unique" ON "user_roles"("user_id", "role_id") WHERE "tenant_id" IS NULL AND "module" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_module_global_unique" ON "user_roles"("user_id", "role_id", "module") WHERE "tenant_id" IS NULL AND "module" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_tenant_global_module_unique" ON "user_roles"("user_id", "role_id", "tenant_id") WHERE "tenant_id" IS NOT NULL AND "module" IS NULL;
CREATE INDEX IF NOT EXISTS "user_roles_user_id_tenant_id_idx" ON "user_roles"("user_id", "tenant_id");
CREATE INDEX IF NOT EXISTS "user_roles_role_id_idx" ON "user_roles"("role_id");
CREATE INDEX IF NOT EXISTS "user_roles_tenant_id_idx" ON "user_roles"("tenant_id");

CREATE UNIQUE INDEX IF NOT EXISTS "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");
CREATE INDEX IF NOT EXISTS "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_roles_user_id_fkey'
  ) THEN
    ALTER TABLE "user_roles"
      ADD CONSTRAINT "user_roles_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_roles_role_id_fkey'
  ) THEN
    ALTER TABLE "user_roles"
      ADD CONSTRAINT "user_roles_role_id_fkey"
      FOREIGN KEY ("role_id") REFERENCES "roles"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_roles_assigned_by_user_id_fkey'
  ) THEN
    ALTER TABLE "user_roles"
      ADD CONSTRAINT "user_roles_assigned_by_user_id_fkey"
      FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'role_permissions_role_id_fkey'
  ) THEN
    ALTER TABLE "role_permissions"
      ADD CONSTRAINT "role_permissions_role_id_fkey"
      FOREIGN KEY ("role_id") REFERENCES "roles"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'role_permissions_permission_id_fkey'
  ) THEN
    ALTER TABLE "role_permissions"
      ADD CONSTRAINT "role_permissions_permission_id_fkey"
      FOREIGN KEY ("permission_id") REFERENCES "permissions"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

INSERT INTO "permissions" ("key", "module", "action", "scope", "description", "system")
VALUES
  ('data_platform:read', 'data_platform', 'read', 'module', 'Visualizar jobs, eventos, tarefas e métricas da Data Platform.', true),
  ('data_platform:operate', 'data_platform', 'operate', 'module', 'Executar ingestões, consumo de indexação, requeues e limpezas operacionais.', true),
  ('data_platform:admin', 'data_platform', 'admin', 'module', 'Administrar a Data Platform com acesso de leitura e operação.', true),
  ('audit:read', 'audit', 'read', 'module', 'Visualizar eventos de auditoria.', true),
  ('audit:admin', 'audit', 'admin', 'module', 'Administrar políticas e consultas de auditoria.', true),
  ('users:read', 'users', 'read', 'module', 'Consultar usuários e permissões administrativas.', true),
  ('users:manage', 'users', 'manage', 'module', 'Gerenciar papéis e permissões RBAC.', true),
  ('marketplace:admin', 'marketplace', 'admin', 'module', 'Administrar marketplace de fornecedores.', true),
  ('legal:admin', 'legal', 'admin', 'module', 'Administrar módulos jurídicos.', true),
  ('investigation:admin', 'investigation', 'admin', 'module', 'Administrar investigação e sinais estratégicos.', true)
ON CONFLICT ("key") DO UPDATE SET
  "module" = EXCLUDED."module",
  "action" = EXCLUDED."action",
  "scope" = EXCLUDED."scope",
  "description" = EXCLUDED."description",
  "system" = true,
  "updated_at" = CURRENT_TIMESTAMP;

WITH seed_roles("key", "name", "description", "scope", "module", "system", "active") AS (
  VALUES
  ('platform_owner', 'Platform Owner', 'Acesso administrativo global a todos os módulos críticos.', 'global', NULL, true, true),
  ('data_platform_admin', 'Data Platform Admin', 'Administra e opera a Data Platform.', 'module', 'data_platform', true, true),
  ('rbac_admin', 'RBAC Admin', 'Gerencia papéis e permissões administrativas.', 'module', 'users', true, true),
  ('audit_admin', 'Audit Admin', 'Consulta e administra trilhas de auditoria.', 'module', 'audit', true, true),
  ('marketplace_admin', 'Marketplace Admin', 'Administra marketplace de fornecedores.', 'module', 'marketplace', true, true),
  ('legal_admin', 'Legal Admin', 'Administra módulos jurídicos.', 'module', 'legal', true, true),
  ('investigation_admin', 'Investigation Admin', 'Administra investigação e inteligência competitiva.', 'module', 'investigation', true, true)
)
INSERT INTO "roles" ("key", "name", "description", "scope", "module", "system", "active")
SELECT sr."key", sr."name", sr."description", sr."scope", sr."module", sr."system", sr."active"
FROM seed_roles sr
WHERE NOT EXISTS (
  SELECT 1
  FROM "roles" r
  WHERE r."key" = sr."key"
    AND r."tenant_id" IS NULL
    AND (
      (r."module" IS NULL AND sr."module" IS NULL)
      OR r."module" = sr."module"
    )
);

WITH seed_roles("key", "name", "description", "scope", "module") AS (
  VALUES
  ('platform_owner', 'Platform Owner', 'Acesso administrativo global a todos os módulos críticos.', 'global', NULL),
  ('data_platform_admin', 'Data Platform Admin', 'Administra e opera a Data Platform.', 'module', 'data_platform'),
  ('rbac_admin', 'RBAC Admin', 'Gerencia papéis e permissões administrativas.', 'module', 'users'),
  ('audit_admin', 'Audit Admin', 'Consulta e administra trilhas de auditoria.', 'module', 'audit'),
  ('marketplace_admin', 'Marketplace Admin', 'Administra marketplace de fornecedores.', 'module', 'marketplace'),
  ('legal_admin', 'Legal Admin', 'Administra módulos jurídicos.', 'module', 'legal'),
  ('investigation_admin', 'Investigation Admin', 'Administra investigação e inteligência competitiva.', 'module', 'investigation')
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
  AND (
    (r."module" IS NULL AND sr."module" IS NULL)
    OR r."module" = sr."module"
  );

WITH role_permission_map(role_key, permission_key) AS (
  VALUES
    ('platform_owner', 'data_platform:read'),
    ('platform_owner', 'data_platform:operate'),
    ('platform_owner', 'data_platform:admin'),
    ('platform_owner', 'audit:read'),
    ('platform_owner', 'audit:admin'),
    ('platform_owner', 'users:read'),
    ('platform_owner', 'users:manage'),
    ('platform_owner', 'marketplace:admin'),
    ('platform_owner', 'legal:admin'),
    ('platform_owner', 'investigation:admin'),
    ('data_platform_admin', 'data_platform:read'),
    ('data_platform_admin', 'data_platform:operate'),
    ('data_platform_admin', 'data_platform:admin'),
    ('rbac_admin', 'users:read'),
    ('rbac_admin', 'users:manage'),
    ('audit_admin', 'audit:read'),
    ('audit_admin', 'audit:admin'),
    ('marketplace_admin', 'marketplace:admin'),
    ('legal_admin', 'legal:admin'),
    ('investigation_admin', 'investigation:admin')
)
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM role_permission_map rpm
JOIN "roles" r ON r."key" = rpm.role_key AND r."tenant_id" IS NULL
JOIN "permissions" p ON p."key" = rpm.permission_key
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
