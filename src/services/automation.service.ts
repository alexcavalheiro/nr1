import { AutomationActionType, Prisma, SystemEventType } from "@prisma/client";
import { prisma } from "../db";

// =============================================================================
// ORQUESTRADOR DE AUTOMAÇÕES (Módulo 8) — CRUD dos fluxos "Quando X → Então Y".
// Os fluxos criados aqui são consumidos pelo motor de eventos (events.ts).
// =============================================================================

export async function listFlows(organizationId: string) {
  return prisma.automationFlow.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { actions: true, runs: true } } },
  });
}

export async function createFlow(organizationId: string, name: string, triggerEvent: SystemEventType) {
  return prisma.automationFlow.create({ data: { organizationId, name, triggerEvent, enabled: true } });
}

export async function getFlowDetail(organizationId: string, id: string) {
  return prisma.automationFlow.findFirst({
    where: { id, organizationId },
    include: {
      actions: { orderBy: { order: "asc" } },
      runs: { orderBy: { startedAt: "desc" }, take: 10, include: { event: { select: { type: true } } } },
    },
  });
}

export async function addAction(flowId: string, type: AutomationActionType, title?: string) {
  const count = await prisma.automationAction.count({ where: { flowId } });
  return prisma.automationAction.create({
    data: { flowId, type, order: count, config: (title ? { title } : {}) as Prisma.InputJsonValue },
  });
}

export async function removeAction(id: string) {
  return prisma.automationAction.delete({ where: { id } });
}

export async function toggleFlow(id: string, enabled: boolean) {
  return prisma.automationFlow.update({ where: { id }, data: { enabled } });
}
