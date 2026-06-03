import { AiAgentType, Prisma, SummaryCadence } from "@prisma/client";
import { prisma } from "../../db";
import { classifySentiment } from "../../domain/sentiment";
import { getHeatmap } from "../risk.service";
import { getRanking } from "../prioritization.service";
import { analyzeSurveyRisks, analyzeTrend, InsightCandidate } from "./analyzer";
import { getLlmClient } from "./llm";

// =============================================================================
// SERVIÇO DE AGENTES DE IA (Módulo 8). Cada agente consome dados da org,
// produz AiInsight (persistido) e, no caso Executivo, um ExecutiveSummary.
// =============================================================================

/** Resolve o agente da org para um tipo (cai no agente global da plataforma). */
async function resolveAgent(organizationId: string, type: AiAgentType) {
  return (
    (await prisma.aiAgent.findFirst({ where: { organizationId, type, enabled: true } })) ??
    (await prisma.aiAgent.findFirst({ where: { organizationId: null, type, enabled: true } }))
  );
}

async function persistInsights(organizationId: string, agentId: string | undefined, candidates: InsightCandidate[]) {
  const created = [];
  for (const c of candidates) {
    created.push(
      await prisma.aiInsight.create({
        data: {
          organizationId,
          agentId,
          type: c.type,
          severity: c.severity,
          confidence: c.confidence,
          scope: c.scope,
          summary: c.summary,
          relatedRiskId: c.relatedRiskId,
          detail: (c.detail ?? {}) as Prisma.InputJsonValue,
        },
      }),
    );
  }
  return created;
}

/** Agente de Saúde Organizacional: detecta riscos e tendências → insights. */
export async function runOrgHealthAgent(organizationId: string) {
  const agent = await resolveAgent(organizationId, AiAgentType.ORG_HEALTH);
  const candidates = [
    ...(await analyzeSurveyRisks(organizationId)),
    ...(await analyzeTrend(organizationId)),
  ];
  return persistInsights(organizationId, agent?.id, candidates);
}

/** Aplica rótulo de sentimento às respostas com base na média das notas. */
export async function labelSurveySentiments(organizationId: string) {
  const responses = await prisma.surveyResponse.findMany({
    where: { survey: { organizationId } },
    include: { answers: { where: { valueNumber: { not: null } }, select: { valueNumber: true } } },
  });
  let labeled = 0;
  for (const r of responses) {
    if (!r.answers.length) continue;
    const avg = r.answers.reduce((s, a) => s + (a.valueNumber ?? 0), 0) / r.answers.length;
    const score = Math.max(0, Math.min(1, (avg - 1) / 4));
    await prisma.surveyResponse.update({
      where: { id: r.id },
      data: { sentimentScore: score, sentimentLabel: classifySentiment(score) },
    });
    labeled++;
  }
  return labeled;
}

/** Agente Executivo: compõe um resumo executivo do período via LLM. */
export async function runExecutiveAgent(
  organizationId: string,
  opts: { cadence?: SummaryCadence; days?: number } = {},
) {
  const cadence = opts.cadence ?? SummaryCadence.WEEKLY;
  const days = opts.days ?? 7;
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - days * 86_400_000);
  const agent = await resolveAgent(organizationId, AiAgentType.EXECUTIVE);

  const [heatmap, ranking, openAlerts, recentInsights] = await Promise.all([
    getHeatmap(organizationId),
    getRanking(organizationId, 3),
    prisma.alert.count({ where: { organizationId, resolved: false } }),
    prisma.aiInsight.findMany({
      where: { organizationId, createdAt: { gte: periodStart } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const highlights = {
    riscosPorNivel: heatmap.countsByLevel,
    alertasAbertos: openAlerts,
    topRiscos: ranking.map((r) => ({ rank: r.rank, risco: r.risk.title, score: r.priorityScore })),
    insightsRecentes: recentInsights.length,
  };

  // Prompt em linguagem executiva; o LlmClient (template ou real) redige o texto.
  const bullets = [
    `Riscos críticos: ${heatmap.countsByLevel.CRITICAL} · altos: ${heatmap.countsByLevel.HIGH}.`,
    `Alertas em aberto: ${openAlerts}.`,
    ranking[0] ? `Prioridade #1: ${ranking[0].risk.title} (score ${ranking[0].priorityScore}).` : "Sem riscos priorizados.",
    `Insights de IA no período: ${recentInsights.length}.`,
  ];
  const llm = getLlmClient(agent?.provider);
  const content = await llm.complete([
    { role: "system", content: "Você é o Agente Executivo: resuma a saúde organizacional em linguagem executiva." },
    { role: "user", content: `Resumo executivo (${cadence}):\n- ${bullets.join("\n- ")}` },
  ]);

  return prisma.executiveSummary.create({
    data: {
      organizationId,
      agentId: agent?.id,
      cadence,
      title: `Resumo executivo (${cadence})`,
      content,
      highlights: highlights as Prisma.InputJsonValue,
      periodStart,
      periodEnd,
    },
  });
}
