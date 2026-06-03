import { ActionStatus, AlertType, IndicatorType, RiskLevel } from "@prisma/client";
import { prisma } from "../db";

// =============================================================================
// SERVIÇO DE MONITORAMENTO — Módulo 6 (Fase 5 NR-1).
// Séries de indicadores + motor de verificação que gera alertas.
// =============================================================================

export interface RecordIndicatorInput {
  organizationId: string;
  type: IndicatorType;
  value: number;
  periodEnd?: Date;
}

export async function recordIndicator(input: RecordIndicatorInput) {
  const periodEnd = input.periodEnd ?? new Date();
  const periodStart = new Date(periodEnd.getTime() - 7 * 86_400_000);
  return prisma.indicatorSnapshot.create({
    data: { organizationId: input.organizationId, type: input.type, value: input.value, periodStart, periodEnd },
  });
}

export interface IndicatorView {
  type: IndicatorType;
  value: number | null;
  previous: number | null;
  deltaPct: number | null; // variação % vs período anterior
  at: Date | null;
}

/** Último valor + variação de cada indicador (para o painel de evolução). */
export async function getIndicators(organizationId: string): Promise<IndicatorView[]> {
  const types = Object.values(IndicatorType);
  const views: IndicatorView[] = [];
  for (const type of types) {
    const last2 = await prisma.indicatorSnapshot.findMany({
      where: { organizationId, type },
      orderBy: { periodEnd: "desc" },
      take: 2,
    });
    const [latest, previous] = last2;
    const deltaPct =
      latest && previous && previous.value !== 0
        ? Math.round(((latest.value - previous.value) / previous.value) * 1000) / 10
        : null;
    views.push({
      type,
      value: latest?.value ?? null,
      previous: previous?.value ?? null,
      deltaPct,
      at: latest?.periodEnd ?? null,
    });
  }
  return views;
}

export async function getAlerts(organizationId: string) {
  return prisma.alert.findMany({
    where: { organizationId },
    orderBy: [{ resolved: "asc" }, { createdAt: "desc" }],
    take: 50,
  });
}

export async function resolveAlert(id: string) {
  return prisma.alert.update({ where: { id }, data: { resolved: true, resolvedAt: new Date() } });
}

/**
 * Motor de verificação (rodável sob demanda ou por cron): gera alertas para
 * planos vencidos e queda de engajamento. Deduplica alertas não resolvidos.
 */
export async function runMonitoringChecks(organizationId: string): Promise<number> {
  let created = 0;

  // 1) Planos de ação vencidos
  const overdue = await prisma.actionPlan.findMany({
    where: {
      organizationId,
      dueDate: { lt: new Date() },
      status: { notIn: [ActionStatus.CLOSED, ActionStatus.CANCELLED] },
    },
  });
  for (const plan of overdue) {
    const exists = await prisma.alert.findFirst({
      where: { organizationId, type: AlertType.OVERDUE_PLAN, relatedPlanId: plan.id, resolved: false },
    });
    if (!exists) {
      await prisma.alert.create({
        data: {
          organizationId,
          type: AlertType.OVERDUE_PLAN,
          severity: RiskLevel.HIGH,
          title: "Plano de ação vencido",
          message: plan.title,
          relatedPlanId: plan.id,
        },
      });
      created++;
    }
  }

  // 2) Queda de engajamento (> 10% vs período anterior)
  const eng = await prisma.indicatorSnapshot.findMany({
    where: { organizationId, type: IndicatorType.ENGAGEMENT },
    orderBy: { periodEnd: "desc" },
    take: 2,
  });
  if (eng.length === 2 && eng[1].value !== 0) {
    const delta = (eng[0].value - eng[1].value) / eng[1].value;
    if (delta <= -0.1) {
      const exists = await prisma.alert.findFirst({
        where: { organizationId, type: AlertType.ENGAGEMENT_DROP, resolved: false },
      });
      if (!exists) {
        await prisma.alert.create({
          data: {
            organizationId,
            type: AlertType.ENGAGEMENT_DROP,
            severity: delta <= -0.2 ? RiskLevel.HIGH : RiskLevel.MODERATE,
            title: "Queda de engajamento",
            message: `Engajamento caiu ${(Math.abs(delta) * 100).toFixed(0)}% (${eng[1].value} → ${eng[0].value}).`,
          },
        });
        created++;
      }
    }
  }

  return created;
}
