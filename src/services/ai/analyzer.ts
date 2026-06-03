import { AiInsightType, IndicatorType, RiskLevel, RiskStatus } from "@prisma/client";
import { prisma } from "../../db";
import { classifySentiment, likertToScore, scoreToSeverity } from "../../domain/sentiment";

// =============================================================================
// ANALISADOR — varre os dados da organização e emite CANDIDATOS a insight.
// Determinístico: a "inteligência" aqui é estatística sobre os dados reais.
// A redação final em linguagem executiva fica a cargo do LlmClient.
// =============================================================================

export interface InsightCandidate {
  type: AiInsightType;
  summary: string;
  severity?: RiskLevel;
  confidence: number; // 0..1
  scope?: string;
  relatedRiskId?: string;
  detail?: Record<string, unknown>;
}

/** Detecta riscos a partir das médias das pesquisas mapeadas a categorias. */
export async function analyzeSurveyRisks(organizationId: string): Promise<InsightCandidate[]> {
  const questions = await prisma.surveyQuestion.findMany({
    where: {
      riskCategoryId: { not: null },
      version: { survey: { organizationId } },
    },
    include: { riskCategory: true },
  });

  const byCategory = new Map<string, { sum: number; n: number; name: string }>();
  for (const q of questions) {
    const agg = await prisma.surveyAnswer.aggregate({
      where: { questionId: q.id, valueNumber: { not: null } },
      _sum: { valueNumber: true },
      _count: { valueNumber: true },
    });
    if (!agg._count.valueNumber) continue;
    const key = q.riskCategoryId!;
    const cur = byCategory.get(key) ?? { sum: 0, n: 0, name: q.riskCategory!.name };
    cur.sum += agg._sum.valueNumber ?? 0;
    cur.n += agg._count.valueNumber;
    byCategory.set(key, cur);
  }

  const candidates: InsightCandidate[] = [];
  for (const [categoryId, { sum, n, name }] of byCategory) {
    const avg = sum / n;
    const score = likertToScore(avg);
    if (score >= 0.5) continue; // sem sinal relevante de risco
    const risk = await prisma.risk.findFirst({
      where: { organizationId, categoryId, status: { not: RiskStatus.CLOSED } },
    });
    candidates.push({
      type: AiInsightType.RISK_DETECTION,
      severity: scoreToSeverity(score),
      confidence: Math.min(1, n / 10),
      summary: `${name}: média ${avg.toFixed(2)}/5 em ${n} respostas (sentimento ${classifySentiment(score)}).`,
      relatedRiskId: risk?.id,
      detail: { categoryId, average: avg, responses: n },
    });
  }
  return candidates;
}

/** Detecta tendência de queda nos indicadores (ex.: engajamento). */
export async function analyzeTrend(
  organizationId: string,
  type: IndicatorType = IndicatorType.ENGAGEMENT,
): Promise<InsightCandidate[]> {
  const series = await prisma.indicatorSnapshot.findMany({
    where: { organizationId, type },
    orderBy: { periodEnd: "desc" },
    take: 2,
  });
  if (series.length < 2) return [];

  const [latest, previous] = series;
  if (previous.value === 0) return [];
  const delta = (latest.value - previous.value) / previous.value;
  if (delta >= -0.1) return []; // queda < 10% não sinaliza

  const severity = delta <= -0.2 ? RiskLevel.HIGH : RiskLevel.MODERATE;
  return [
    {
      type: AiInsightType.TREND,
      severity,
      confidence: 0.8,
      scope: type,
      summary: `Queda de ${(Math.abs(delta) * 100).toFixed(0)}% em ${type} (${previous.value} → ${latest.value}).`,
      detail: { type, from: previous.value, to: latest.value, delta },
    },
  ];
}
