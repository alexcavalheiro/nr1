import { ActionStatus } from "@prisma/client";
import { prisma } from "../../db";
import { getHeatmap } from "../risk.service";
import { getRanking } from "../prioritization.service";
import { getIndicators } from "../monitoring.service";
import { getLlmClient, hasRealLlm } from "./llm";

// =============================================================================
// ASSISTENTE VIRTUAL / COPILOTO NR-1 (Módulo 8).
// Responde perguntas em linguagem natural consultando os dados reais da org.
// Sem chave de API: respostas determinísticas por intenção. Com ANTHROPIC_API_KEY:
// o LLM redige a resposta a partir do mesmo contexto factual.
// =============================================================================

const LEVEL_LABEL: Record<string, string> = { LOW: "Baixo", MODERATE: "Moderado", HIGH: "Alto", CRITICAL: "Crítico" };
const IND_LABEL: Record<string, string> = {
  CLIMATE: "Clima", ENGAGEMENT: "Engajamento", TURNOVER: "Rotatividade", ABSENTEEISM: "Absenteísmo",
  MEDICAL_LEAVE: "Afastamentos", PARTICIPATION: "Participação",
};

async function gatherContext(organizationId: string) {
  const [heatmap, ranking, overdue, openAlerts, indicators, manifestations, surveys] = await Promise.all([
    getHeatmap(organizationId),
    getRanking(organizationId, 5),
    prisma.actionPlan.findMany({
      where: { organizationId, dueDate: { lt: new Date() }, status: { notIn: [ActionStatus.CLOSED, ActionStatus.CANCELLED] } },
      select: { title: true, dueDate: true },
    }),
    prisma.alert.count({ where: { organizationId, resolved: false } }),
    getIndicators(organizationId),
    prisma.manifestation.count({ where: { organizationId } }),
    prisma.survey.count({ where: { organizationId } }),
  ]);
  return { heatmap, ranking, overdue, openAlerts, indicators, manifestations, surveys };
}

type Ctx = Awaited<ReturnType<typeof gatherContext>>;

function deterministicAnswer(q: string, ctx: Ctx): string {
  const t = q.toLowerCase();

  if (/(plano).*(venc|atras)|venc/.test(t)) {
    if (!ctx.overdue.length) return "Nenhum plano de ação está vencido no momento. ✅";
    return `Há ${ctx.overdue.length} plano(s) de ação vencido(s):\n` +
      ctx.overdue.map((p) => `• ${p.title}${p.dueDate ? ` (venceu em ${new Date(p.dueDate).toLocaleDateString("pt-BR")})` : ""}`).join("\n");
  }

  if (/crític|critic|maior risco|áreas|areas|prioridade|prioriz|pior/.test(t)) {
    const crit = ctx.heatmap.cells.filter((c) => c.level === "CRITICAL");
    const lines = ctx.ranking.map((r) => `#${r.rank} ${r.risk.title} — ${r.risk.category.name} (score ${r.priorityScore})`);
    return `Riscos por nível: Crítico ${ctx.heatmap.countsByLevel.CRITICAL}, Alto ${ctx.heatmap.countsByLevel.HIGH}, Moderado ${ctx.heatmap.countsByLevel.MODERATE}, Baixo ${ctx.heatmap.countsByLevel.LOW}.\n` +
      (crit.length ? `Riscos críticos por setor: ${crit.map((c) => `${c.categoryCode} (${c.departmentName ?? "Corporativo"})`).join(", ")}.\n` : "") +
      (lines.length ? `Top prioridades:\n${lines.join("\n")}` : "Nenhum risco priorizado ainda.");
  }

  if (/alerta/.test(t)) {
    return `Há ${ctx.openAlerts} alerta(s) em aberto. Acesse Monitoramento para tratá-los.`;
  }

  if (/engajamento|indicador|clima|rotativ|absente|afastamento|participa/.test(t)) {
    const withData = ctx.indicators.filter((i) => i.value !== null);
    if (!withData.length) return "Ainda não há indicadores registrados. Registre-os em Monitoramento.";
    return "Indicadores atuais:\n" + withData.map((i) =>
      `• ${IND_LABEL[i.type] ?? i.type}: ${i.value}${i.deltaPct != null ? ` (${i.deltaPct > 0 ? "+" : ""}${i.deltaPct}%)` : ""}`).join("\n");
  }

  if (/denúncia|denuncia|manifesta|escuta|assédio|assedio/.test(t)) {
    return `Foram registradas ${ctx.manifestations} manifestação(ões) na escuta ativa. Veja detalhes e tratativas na aba Escuta.`;
  }

  if (/pesquisa|clima|diagn/.test(t)) {
    return `Existem ${ctx.surveys} pesquisa(s) cadastradas. Use a aba Pesquisas para aplicar e derivar riscos.`;
  }

  const total = Object.values(ctx.heatmap.countsByLevel).reduce((a, b) => a + b, 0);
  return `Posso ajudar com riscos, planos de ação, alertas, indicadores e pesquisas.\n` +
    `Panorama atual: ${total} risco(s) no inventário (${ctx.heatmap.countsByLevel.CRITICAL} crítico(s)), ` +
    `${ctx.openAlerts} alerta(s) aberto(s), ${ctx.overdue.length} plano(s) vencido(s).`;
}

export async function answerQuestion(organizationId: string, question: string): Promise<string> {
  const ctx = await gatherContext(organizationId);
  const factual = deterministicAnswer(question, ctx);

  if (!hasRealLlm()) return factual;

  // Com LLM real: usa os fatos como contexto para uma resposta mais natural.
  const llm = getLlmClient();
  return llm.complete([
    { role: "system", content: "Você é o Copiloto NR-1, assistente de saúde organizacional e conformidade. Responda em português, de forma objetiva e executiva, usando apenas os dados fornecidos." },
    { role: "user", content: `Contexto (dados da organização):\n${factual}\n\nPergunta do gestor: ${question}` },
  ]);
}

async function getOrCreateConversation(organizationId: string, userId: string) {
  const existing = await prisma.aiConversation.findFirst({
    where: { organizationId, userId },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) return existing;
  const agent = await prisma.aiAgent.findFirst({ where: { organizationId: null, type: "ASSISTANT" } });
  return prisma.aiConversation.create({
    data: { organizationId, userId, agentId: agent?.id, title: "Assistente NR-1" },
  });
}

export async function getConversation(organizationId: string, userId: string) {
  const conv = await getOrCreateConversation(organizationId, userId);
  return prisma.aiConversation.findUniqueOrThrow({
    where: { id: conv.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
}

export async function sendAssistantMessage(organizationId: string, userId: string, text: string) {
  const conv = await getOrCreateConversation(organizationId, userId);
  await prisma.aiMessage.create({ data: { conversationId: conv.id, role: "USER", content: text } });
  const answer = await answerQuestion(organizationId, text);
  await prisma.aiMessage.create({ data: { conversationId: conv.id, role: "ASSISTANT", content: answer } });
  await prisma.aiConversation.update({ where: { id: conv.id }, data: { updatedAt: new Date() } });
  return conv.id;
}
