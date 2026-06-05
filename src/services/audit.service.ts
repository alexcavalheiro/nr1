import { Prisma } from "@prisma/client";
import { prisma } from "../db";

// =============================================================================
// AUDITORIA E LOGS — trilha de ações dos usuários (login, alterações de
// permissão/perfil, exclusões, exportações…). Grava em AuditLog (já existente).
// =============================================================================

export interface AuditInput {
  organizationId?: string;
  actorId?: string;
  action: string; // ex: "user.role_changed", "risk.deleted"
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

/** Registra uma entrada de auditoria. Best-effort: nunca quebra a ação principal. */
export async function writeAudit(input: AuditInput) {
  try {
    return await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  } catch {
    return null;
  }
}

export interface AuditFilter {
  action?: string;
  entityType?: string;
  take?: number;
}

export async function listAuditLogs(organizationId: string, filter: AuditFilter = {}) {
  return prisma.auditLog.findMany({
    where: {
      organizationId,
      action: filter.action ? { contains: filter.action } : undefined,
      entityType: filter.entityType || undefined,
    },
    orderBy: { createdAt: "desc" },
    take: filter.take ?? 200,
    include: { actor: { select: { name: true, email: true } } },
  });
}

/** Indicadores de Usuários e Acessos (PDF: "DASHBOARD DE USUÁRIOS E ACESSOS"). */
export async function accessDashboard(organizationId: string) {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [members, loginsByUser, failed30, permChanges30, recentLogins] = await Promise.all([
    prisma.membership.findMany({
      where: { organizationId },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.auditLog.groupBy({
      by: ["actorId"],
      where: { organizationId, action: "auth.login" },
      _max: { createdAt: true },
    }),
    prisma.auditLog.count({ where: { organizationId, action: "auth.login_failed", createdAt: { gte: since } } }),
    prisma.auditLog.count({ where: { organizationId, action: "user.role_changed", createdAt: { gte: since } } }),
    prisma.auditLog.findMany({
      where: { organizationId, action: "auth.login" },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: { select: { name: true } } },
    }),
  ]);

  const lastLogin = new Map<string, Date>();
  for (const g of loginsByUser) if (g.actorId && g._max.createdAt) lastLogin.set(g.actorId, g._max.createdAt);

  const byRole: Record<string, number> = {};
  let active = 0;
  let inactive = 0;
  let noAccess30 = 0;
  for (const m of members) {
    if (m.active) active++;
    else inactive++;
    byRole[m.role] = (byRole[m.role] ?? 0) + 1;
    const ll = lastLogin.get(m.userId);
    if (!ll || ll < since) noAccess30++;
  }

  return {
    total: members.length,
    active,
    inactive,
    byRole,
    noAccess30,
    failed30,
    permChanges30,
    recentLogins: recentLogins.map((l) => ({ name: l.actor?.name ?? "—", at: l.createdAt })),
  };
}

export async function auditStats(organizationId: string) {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [total, last30, byAction, byEntity] = await Promise.all([
    prisma.auditLog.count({ where: { organizationId } }),
    prisma.auditLog.count({ where: { organizationId, createdAt: { gte: since } } }),
    prisma.auditLog.groupBy({ by: ["action"], where: { organizationId }, _count: true, orderBy: { _count: { action: "desc" } }, take: 8 }),
    prisma.auditLog.groupBy({ by: ["entityType"], where: { organizationId }, _count: true, orderBy: { _count: { entityType: "desc" } }, take: 8 }),
  ]);
  return {
    total,
    last30,
    byAction: byAction.map((a) => ({ action: a.action, count: a._count })),
    byEntity: byEntity.map((e) => ({ entityType: e.entityType, count: e._count })),
  };
}
