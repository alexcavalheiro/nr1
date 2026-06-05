import { prisma } from "../db";

// =============================================================================
// ACESSO POR ESCOPO (empresa / unidade / setor)
// A hierarquia da plataforma é Organization → Department (auto-hierarquia via
// parentId: diretoria > gerência > equipe). Gestores e Auditor têm acesso
// total; demais perfis enxergam apenas a subárvore do seu próprio setor.
// =============================================================================

/** Perfis com visão total (sem filtro de escopo). */
const FULL_SCOPE_ROLES = new Set(["SUPER_ADMIN", "CONSULTANT", "COMPANY_ADMIN", "HR", "AUDITOR"]);

export interface ScopeSession {
  userId: string;
  organizationId: string;
  role: string;
}

export function hasFullScope(role: string): boolean {
  return FULL_SCOPE_ROLES.has(role);
}

/**
 * IDs de departamento visíveis ao usuário.
 * - `null`  → acesso total (não aplicar filtro).
 * - `[]`    → usuário restrito sem setor definido (não vê dados com setor).
 * - `[...]` → setor do usuário + toda a subárvore abaixo dele.
 */
export async function scopedDepartmentIds(session: ScopeSession): Promise<string[] | null> {
  if (hasFullScope(session.role)) return null;

  const membership = await prisma.membership.findFirst({
    where: { userId: session.userId, organizationId: session.organizationId },
    select: { departmentId: true },
  });
  if (!membership?.departmentId) return [];

  const all = await prisma.department.findMany({
    where: { organizationId: session.organizationId },
    select: { id: true, parentId: true },
  });
  const childrenOf = new Map<string, string[]>();
  for (const d of all) {
    if (!d.parentId) continue;
    const list = childrenOf.get(d.parentId) ?? [];
    list.push(d.id);
    childrenOf.set(d.parentId, list);
  }

  const ids: string[] = [];
  const stack = [membership.departmentId];
  while (stack.length) {
    const id = stack.pop()!;
    ids.push(id);
    for (const child of childrenOf.get(id) ?? []) stack.push(child);
  }
  return ids;
}

/** Cláusula Prisma `where` para um campo `departmentId` opcional. */
export function departmentScopeClause(departmentIds: string[] | null | undefined) {
  return Array.isArray(departmentIds) ? { departmentId: { in: departmentIds } } : {};
}
