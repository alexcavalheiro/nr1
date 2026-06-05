import { RiskLevel, RiskStatus, SystemEventType } from "@prisma/client";
import { prisma } from "../db";
import { assessmentScore, classifyByScore, DEFAULT_RISK_MATRIX, RiskMatrix } from "../domain/scoring";
import { emitEvent } from "./events";

// =============================================================================
// SERVIÇO DE RISCO — Módulos 2 (identificação), 3 (avaliação), 6 (heatmap).
// =============================================================================

export interface CreateRiskInput {
  organizationId: string;
  categoryId: string;
  title: string;
  description?: string;
  departmentId?: string;
  source?: string;
}

export async function createRisk(input: CreateRiskInput) {
  const risk = await prisma.risk.create({ data: { ...input, status: RiskStatus.IDENTIFIED } });
  await emitEvent({
    organizationId: risk.organizationId,
    type: SystemEventType.NEW_RISK,
    entityType: "Risk",
    entityId: risk.id,
    payload: { riskId: risk.id, title: risk.title, departmentId: risk.departmentId ?? undefined },
  });
  return risk;
}

export interface UpdateRiskInput {
  title?: string;
  categoryId?: string;
  departmentId?: string | null;
  description?: string | null;
  status?: RiskStatus;
}

export async function updateRisk(riskId: string, organizationId: string, input: UpdateRiskInput) {
  const risk = await prisma.risk.findFirst({ where: { id: riskId, organizationId } });
  if (!risk) throw new Error("Risco não encontrado.");
  if (input.title !== undefined && !input.title.trim()) throw new Error("Título obrigatório.");
  return prisma.risk.update({
    where: { id: riskId },
    data: {
      title: input.title?.trim() ?? undefined,
      categoryId: input.categoryId || undefined,
      departmentId: input.departmentId === undefined ? undefined : input.departmentId || null,
      description: input.description === undefined ? undefined : input.description || null,
      status: input.status ?? undefined,
    },
  });
}

/** Exclui um risco e tudo que cascateia (avaliações, priorização, planos, fontes). */
export async function deleteRisk(riskId: string, organizationId: string) {
  const risk = await prisma.risk.findFirst({ where: { id: riskId, organizationId } });
  if (!risk) throw new Error("Risco não encontrado.");
  return prisma.risk.delete({ where: { id: riskId } });
}

export interface AssessRiskInput {
  riskId: string;
  probability: number; // 1..5
  impact: number; // 1..5
  assessedById?: string;
  notes?: string;
}

/**
 * Registra uma avaliação (Módulo 3). Histórico preservado: a avaliação anterior
 * é marcada isCurrent=false e a nova vira a vigente. Emite evento — crítico
 * dispara CRITICAL_RISK_DETECTED (consumido pelo motor de automações).
 */
export async function assessRisk(input: AssessRiskInput) {
  const risk = await prisma.risk.findUniqueOrThrow({ where: { id: input.riskId } });
  const matrix = await resolveMatrix(risk.organizationId);

  const score = assessmentScore(input.probability, input.impact);
  const classification = classifyByScore(score, matrix);

  const assessment = await prisma.$transaction(async (tx) => {
    await tx.riskAssessment.updateMany({
      where: { riskId: risk.id, isCurrent: true },
      data: { isCurrent: false },
    });
    const created = await tx.riskAssessment.create({
      data: {
        riskId: risk.id,
        probability: input.probability,
        impact: input.impact,
        score,
        classification,
        assessedById: input.assessedById,
        notes: input.notes,
        isCurrent: true,
      },
    });
    await tx.risk.update({ where: { id: risk.id }, data: { status: RiskStatus.ASSESSED } });
    return created;
  });

  await emitEvent({
    organizationId: risk.organizationId,
    type: classification === RiskLevel.CRITICAL ? SystemEventType.CRITICAL_RISK_DETECTED : SystemEventType.RISK_CHANGED,
    entityType: "Risk",
    entityId: risk.id,
    payload: { riskId: risk.id, title: risk.title, score, classification, departmentId: risk.departmentId ?? undefined },
  });

  return assessment;
}

/** Carrega a matriz configurada da organização; cai no padrão se não houver. */
async function resolveMatrix(organizationId: string): Promise<RiskMatrix> {
  const cfg = await prisma.riskMatrixConfig.findUnique({ where: { organizationId } });
  return cfg
    ? { lowMax: cfg.lowMax, moderateMax: cfg.moderateMax, highMax: cfg.highMax }
    : DEFAULT_RISK_MATRIX;
}

// -----------------------------------------------------------------------------
// LEITURA p/ UI: lista de riscos da org e detalhe completo (escopado por tenant).
// -----------------------------------------------------------------------------
export async function listRisks(organizationId: string, departmentIds?: string[] | null) {
  return prisma.risk.findMany({
    where: {
      organizationId,
      ...(Array.isArray(departmentIds) ? { departmentId: { in: departmentIds } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      category: { select: { name: true, code: true } },
      department: { select: { name: true } },
      assessments: { where: { isCurrent: true }, take: 1 },
      prioritization: { select: { rank: true, priorityScore: true } },
      _count: { select: { actionPlans: true } },
    },
  });
}

export async function getRiskDetail(organizationId: string, riskId: string) {
  return prisma.risk.findFirst({
    where: { id: riskId, organizationId }, // isolamento por tenant
    include: {
      category: true,
      department: true,
      assessments: { orderBy: { assessedAt: "desc" } },
      prioritization: true,
      sources: true,
      actionPlans: {
        orderBy: { createdAt: "desc" },
        include: {
          owner: { select: { name: true } },
          evidences: true,
          comments: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
}

// -----------------------------------------------------------------------------
// HEATMAP ORGANIZACIONAL (Módulo 6) — risco vigente por setor × categoria.
// -----------------------------------------------------------------------------
export interface HeatmapCell {
  departmentId: string | null;
  departmentName: string | null;
  categoryCode: string;
  level: RiskLevel;
  score: number;
  riskId: string;
}

export async function getHeatmap(organizationId: string): Promise<{
  cells: HeatmapCell[];
  countsByLevel: Record<RiskLevel, number>;
}> {
  const risks = await prisma.risk.findMany({
    where: { organizationId, status: { not: RiskStatus.CLOSED } },
    include: {
      department: { select: { name: true } },
      category: { select: { code: true } },
      assessments: { where: { isCurrent: true }, take: 1 },
    },
  });

  const counts: Record<RiskLevel, number> = { LOW: 0, MODERATE: 0, HIGH: 0, CRITICAL: 0 };
  const cells: HeatmapCell[] = [];

  for (const r of risks) {
    const a = r.assessments[0];
    if (!a) continue; // ainda não avaliado
    counts[a.classification]++;
    cells.push({
      departmentId: r.departmentId,
      departmentName: r.department?.name ?? null,
      categoryCode: r.category.code,
      level: a.classification,
      score: a.score,
      riskId: r.id,
    });
  }

  return { cells, countsByLevel: counts };
}
