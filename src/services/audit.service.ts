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
