import { Role } from "@prisma/client";
import { prisma } from "../db";

// =============================================================================
// RBAC GRANULAR — permissões por módulo/ação configuráveis por perfil.
// Sem linha configurada, vale o padrão (defaultAllow). Enforcement é aditivo:
// chame requirePermission/isAllowed onde quiser endurecer o acesso.
// =============================================================================

export const MODULES: { key: string; label: string }[] = [
  { key: "empresas", label: "Empresas e Unidades" },
  { key: "setores", label: "Setores e Departamentos" },
  { key: "colaboradores", label: "Colaboradores" },
  { key: "avaliacoes", label: "Avaliações Psicossociais" },
  { key: "riscos", label: "Inventário de Riscos" },
  { key: "planos", label: "Planos de Ação" },
  { key: "documentos", label: "Documentos e Evidências" },
  { key: "escuta", label: "Relatos e Canal de Escuta" },
  { key: "treinamentos", label: "Treinamentos e Campanhas" },
  { key: "dashboard", label: "Dashboard" },
  { key: "import_export", label: "Importação e Exportação" },
  { key: "usuarios", label: "Usuários e Permissões" },
];

export const ACTIONS: { key: string; label: string }[] = [
  { key: "view", label: "Visualizar" },
  { key: "create", label: "Criar" },
  { key: "edit", label: "Editar" },
  { key: "delete", label: "Excluir" },
];

export const RBAC_ROLES: Role[] = [
  Role.COMPANY_ADMIN,
  Role.UNIT_MANAGER,
  Role.CONSULTANT,
  Role.HR,
  Role.LEADER,
  Role.EMPLOYEE,
  Role.AUDITOR,
  Role.SESMT,
  Role.OCCUPATIONAL_DOCTOR,
  Role.CIPA_MEMBER,
];

const MANAGER_ROLES: Role[] = [Role.SUPER_ADMIN, Role.CONSULTANT, Role.COMPANY_ADMIN, Role.HR, Role.UNIT_MANAGER];
const READONLY_ROLES: Role[] = [Role.AUDITOR, Role.SESMT, Role.OCCUPATIONAL_DOCTOR, Role.CIPA_MEMBER];

/** Padrão quando não há configuração: gestores tudo; conformidade só leitura; demais nada. */
export function defaultAllow(role: Role, action: string): boolean {
  if (MANAGER_ROLES.includes(role)) return true;
  if (READONLY_ROLES.includes(role)) return action === "view";
  return false;
}

export async function getPermissionMatrix(organizationId: string) {
  const rows = await prisma.rolePermission.findMany({ where: { organizationId } });
  const map = new Map<string, boolean>();
  for (const r of rows) map.set(`${r.role}|${r.module}|${r.action}`, r.allowed);
  return map; // chave: "ROLE|module|action"
}

export async function isAllowed(organizationId: string, role: string, module: string, action: string): Promise<boolean> {
  const row = await prisma.rolePermission.findUnique({
    where: { organizationId_role_module_action: { organizationId, role: role as Role, module, action } },
  });
  return row ? row.allowed : defaultAllow(role as Role, action);
}

export async function requirePermission(
  session: { organizationId: string; role: string },
  module: string,
  action: string,
) {
  if (!(await isAllowed(session.organizationId, session.role, module, action))) {
    throw new Error(`Sem permissão para ${action} em ${module}.`);
  }
}

export async function setPermission(
  organizationId: string,
  role: Role,
  module: string,
  action: string,
  allowed: boolean,
) {
  return prisma.rolePermission.upsert({
    where: { organizationId_role_module_action: { organizationId, role, module, action } },
    update: { allowed },
    create: { organizationId, role, module, action, allowed },
  });
}
