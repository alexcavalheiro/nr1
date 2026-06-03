import { ActionStatus } from "@prisma/client";
import { prisma } from "../db";

// =============================================================================
// SERVIÇO DE PLANOS DE AÇÃO — Módulo 5 (Fase 4 NR-1).
// Fluxo: CREATED → APPROVED → IN_PROGRESS → EVIDENCED → CLOSED
// =============================================================================

export interface CreateActionPlanInput {
  organizationId: string;
  riskId?: string;
  title: string;
  description?: string;
  ownerId?: string;
  dueDate?: Date;
}

export async function createActionPlan(input: CreateActionPlanInput) {
  return prisma.actionPlan.create({ data: { ...input, status: ActionStatus.CREATED } });
}

const NEXT_STATUS: Record<ActionStatus, ActionStatus | null> = {
  CREATED: ActionStatus.APPROVED,
  APPROVED: ActionStatus.IN_PROGRESS,
  IN_PROGRESS: ActionStatus.EVIDENCED,
  EVIDENCED: ActionStatus.CLOSED,
  CLOSED: null,
  CANCELLED: null,
};

/** Avança o plano para o próximo estágio do fluxo, marcando datas-chave. */
export async function advanceActionPlan(id: string) {
  const plan = await prisma.actionPlan.findUniqueOrThrow({ where: { id } });
  const next = NEXT_STATUS[plan.status];
  if (!next) return plan;
  return prisma.actionPlan.update({
    where: { id },
    data: {
      status: next,
      approvedAt: next === ActionStatus.APPROVED ? new Date() : plan.approvedAt,
      closedAt: next === ActionStatus.CLOSED ? new Date() : plan.closedAt,
    },
  });
}

export async function addActionComment(actionPlanId: string, authorId: string | undefined, body: string) {
  return prisma.actionComment.create({ data: { actionPlanId, authorId, body } });
}

export async function addActionEvidence(actionPlanId: string, fileUrl: string, description?: string, uploadedById?: string) {
  return prisma.actionEvidence.create({ data: { actionPlanId, fileUrl, description, uploadedById } });
}
