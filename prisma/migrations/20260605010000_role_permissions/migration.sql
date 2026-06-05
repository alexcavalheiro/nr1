-- RBAC granular (Bloco 3): permissões por módulo configuráveis por perfil.
-- Idempotente. Aplicado pelo ensureDb no PGlite; no Supabase, rode manualmente.
-- Usa o tipo enum "Role" já existente.

CREATE TABLE IF NOT EXISTS "RolePermission" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "module" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "allowed" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RolePermission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "RolePermission_org_role_module_action_key" ON "RolePermission"("organizationId", "role", "module", "action");
CREATE INDEX IF NOT EXISTS "RolePermission_organizationId_idx" ON "RolePermission"("organizationId");
