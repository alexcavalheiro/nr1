import { RiskStatus } from "@prisma/client";
import { prisma } from "../db";
import { PriorityCriteria, priorityScore } from "../domain/scoring";

// =============================================================================
// SERVIÇO DE PRIORIZAÇÃO — Módulo 4 (Fase 3 NR-1).
// =============================================================================

export interface PrioritizeInput extends PriorityCriteria {
  riskId: string;
}

/** Calcula e grava o score composto de priorização e recalcula o ranking. */
export async function prioritizeRisk(input: PrioritizeInput) {
  const { riskId, ...criteria } = input;
  const risk = await prisma.risk.findUniqueOrThrow({ where: { id: riskId } });
  const score = priorityScore(criteria);

  const prioritization = await prisma.$transaction(async (tx) => {
    const p = await tx.riskPrioritization.upsert({
      where: { riskId },
      update: { ...criteria, priorityScore: score, computedAt: new Date() },
      create: { riskId, ...criteria, priorityScore: score },
    });
    await tx.risk.update({ where: { id: riskId }, data: { status: RiskStatus.PRIORITIZED } });
    return p;
  });

  await recomputeRanking(risk.organizationId);
  return prioritization;
}

/**
 * Recalcula o ranking de toda a organização: ordena por priorityScore desc e
 * grava a posição (1 = mais prioritário). Roda em lote após cada priorização.
 */
export async function recomputeRanking(organizationId: string) {
  const items = await prisma.riskPrioritization.findMany({
    where: { risk: { organizationId } },
    orderBy: { priorityScore: "desc" },
    select: { id: true },
  });

  await prisma.$transaction(
    items.map((item, idx) =>
      prisma.riskPrioritization.update({ where: { id: item.id }, data: { rank: idx + 1 } }),
    ),
  );
  return items.length;
}

/** Ranking pronto para painel executivo (Módulo 4). */
export async function getRanking(organizationId: string, limit = 50) {
  return prisma.riskPrioritization.findMany({
    where: { risk: { organizationId }, rank: { not: null } },
    orderBy: { rank: "asc" },
    take: limit,
    include: {
      risk: {
        select: {
          id: true,
          title: true,
          status: true,
          category: { select: { code: true, name: true } },
          department: { select: { name: true } },
        },
      },
    },
  });
}
