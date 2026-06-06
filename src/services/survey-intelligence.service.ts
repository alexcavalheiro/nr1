import { prisma } from "../db";
import { surveyScores, CLASS_LABEL } from "./survey-score.service";

// =============================================================================
// FASE 2 — Inteligência da pesquisa: motor de alertas, análise de respostas
// abertas, plano de ação 5W2H e relatório executivo. Tudo derivado dos dados
// (sem dependência de IA externa; usa LLM só se disponível, no futuro).
// =============================================================================

const MIN_RESPONSES = 5; // anonimato: nada segmentado abaixo disso

export interface SurveyAlert {
  type: string;
  severity: "alto" | "medio";
  title: string;
  description: string;
  confidential: boolean;
}

const HARASSMENT = ["humilh", "grito", "exposi", "ameaç", "ameac", "discrimin", "assédio", "assedio", "perseg"];

export async function surveyAlerts(surveyId: string): Promise<SurveyAlert[]> {
  const scores = await surveyScores(surveyId);
  const alerts: SurveyAlert[] = [];
  if (scores.responses < MIN_RESPONSES) return alerts;

  const byDim = new Map(scores.dimensions.map((d) => [d.key, d.score]));
  const g = (k: string) => byDim.get(k) ?? null;

  // Burnout: bem-estar + sobrecarga + pulso baixos simultaneamente.
  if ((g("bem_estar") ?? 100) < 50 && (g("sobrecarga") ?? 100) < 50 && (g("pulso") ?? 100) < 50) {
    alerts.push({ type: "BURNOUT", severity: "alto", title: "Risco de Burnout", description: "Combinação de baixo bem-estar, alta sobrecarga e pulso emocional negativo.", confidential: false });
  }
  // Conduta grave / assédio: respostas sensíveis indicando situações.
  const sensitive = await prisma.surveyAnswer.findMany({
    where: { response: { surveyId }, question: { sensitive: true } },
    select: { valueOption: true, valueText: true },
  });
  const flags = sensitive.filter((a) => {
    const v = `${a.valueOption ?? ""} ${a.valueText ?? ""}`.toLowerCase();
    if (/\b(sim|yes|true)\b/.test(v)) return true;
    return HARASSMENT.some((h) => v.includes(h));
  }).length;
  if (flags > 0) {
    alerts.push({ type: "HARASSMENT", severity: "alto", title: "Indícios de assédio/conduta grave", description: `${flags} resposta(s) sinalizaram humilhação, assédio, discriminação ou perseguição. Tratar de forma confidencial.`, confidential: true });
  }
  // Liderança / Segurança / Clima.
  if ((g("lideranca") ?? 100) < 60) alerts.push({ type: "LEADERSHIP", severity: "medio", title: "Liderança abaixo do saudável", description: `Índice de Liderança Saudável em ${g("lideranca")}.`, confidential: false });
  if ((g("seguranca") ?? 100) < 60) alerts.push({ type: "PSY_SAFETY", severity: "medio", title: "Baixa segurança psicológica", description: `Índice de Segurança Psicológica em ${g("seguranca")}.`, confidential: false });
  if (scores.general.score < 60) alerts.push({ type: "CRITICAL_CLIMATE", severity: "alto", title: "Clima organizacional crítico", description: `Índice Geral de Saúde Organizacional em ${scores.general.score}.`, confidential: false });

  return alerts;
}

// ---- Análise de respostas abertas (heurística, offline) -------------------
const THEMES: { key: string; label: string; terms: string[] }[] = [
  { key: "lideranca", label: "Liderança", terms: ["líder", "lider", "gestor", "chefe", "gerente", "coordenad"] },
  { key: "sobrecarga", label: "Sobrecarga", terms: ["sobrecarreg", "sobrecarga", "carga", "prazo", "pressão", "pressao", "exaust", "cansa", "estafa", "demanda", "hora extra"] },
  { key: "reconhecimento", label: "Reconhecimento", terms: ["reconhec", "valoriz", "salár", "salar", "remuner", "benefíc", "benefic"] },
  { key: "comunicacao", label: "Comunicação", terms: ["comunic", "informaç", "transparên", "transparen", "ruído"] },
  { key: "assedio", label: "Assédio/Conduta", terms: HARASSMENT },
  { key: "ambiente", label: "Ambiente", terms: ["ambiente", "clima", "fofoca", "intriga", "relacionament"] },
  { key: "carreira", label: "Carreira", terms: ["cresc", "carreira", "promoç", "promoc", "desenvolv"] },
  { key: "saude_mental", label: "Saúde mental", terms: ["ansiedad", "estresse", "estress", "depress", "burnout", "saúde", "saude", "emocional"] },
];
const NEG = ["não", "nao", "ruim", "péssimo", "pessimo", "falta", "nunca", "difícil", "dificil", "problema", "sobrecarga", "pressão", "pressao", "cansa", "exaust", "ansiedad", "estresse", "assédio", "assedio", "humilh", "medo", "injust"];
const POS = ["bom", "ótimo", "otimo", "excelente", "gosto", "feliz", "orgulho", "respeito", "apoio", "equilíbrio", "equilibrio", "agradeç"];

function classifyText(text: string) {
  const t = text.toLowerCase();
  const themes = THEMES.filter((th) => th.terms.some((term) => t.includes(term))).map((th) => th.label);
  const neg = NEG.filter((w) => t.includes(w)).length;
  const pos = POS.filter((w) => t.includes(w)).length;
  const sentiment = neg > pos ? "negativo" : pos > neg ? "positivo" : "neutro";
  const grave = THEMES.find((th) => th.key === "assedio")!.terms.some((term) => t.includes(term)) ||
    THEMES.find((th) => th.key === "saude_mental")!.terms.some((term) => t.includes(term));
  const severity = grave ? "alta" : sentiment === "negativo" ? "média" : "baixa";
  return { themes, sentiment, severity, actionNeeded: severity !== "baixa" };
}

export async function analyzeOpenAnswers(surveyId: string) {
  const answers = await prisma.surveyAnswer.findMany({
    where: { response: { surveyId }, valueText: { not: null } },
    select: { valueText: true },
  });
  const texts = answers.map((a) => (a.valueText ?? "").trim()).filter((t) => t.length > 1);
  const themeCount = new Map<string, number>();
  const flagged: { text: string; themes: string[]; severity: string }[] = [];
  let neg = 0, pos = 0, neu = 0;
  for (const text of texts) {
    const c = classifyText(text);
    for (const th of c.themes) themeCount.set(th, (themeCount.get(th) ?? 0) + 1);
    if (c.sentiment === "negativo") neg++; else if (c.sentiment === "positivo") pos++; else neu++;
    if (c.actionNeeded) flagged.push({ text: text.slice(0, 280), themes: c.themes, severity: c.severity });
  }
  const topThemes = [...themeCount.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));
  return {
    total: texts.length,
    sentiment: { negativo: neg, positivo: pos, neutro: neu },
    topThemes,
    flagged: flagged.sort((a, b) => (a.severity === "alta" ? -1 : 1)).slice(0, 12),
  };
}

// ---- Plano de ação sugerido (5W2H) ----------------------------------------
export interface Plan5W2H {
  dimension: string; risco: string;
  oQue: string; porQue: string; quem: string; quando: string; onde: string; como: string; indicador: string;
}
const PLAN_TEMPLATES: Record<string, Omit<Plan5W2H, "dimension" | "risco">> = {
  sobrecarga: { oQue: "Revisar distribuição de tarefas, metas e prazos", porQue: "Reduzir risco de exaustão e pressão excessiva", quem: "RH e liderança da área", quando: "até 30 dias", onde: "áreas com índice baixo", como: "entrevistas, revisão de metas e redistribuição de demandas", indicador: "aumento do Índice de Sobrecarga na próxima pesquisa" },
  lideranca: { oQue: "Programa de desenvolvimento de líderes (feedback, escuta, gestão emocional)", porQue: "Elevar a qualidade da liderança e a confiança das equipes", quem: "RH e Desenvolvimento", quando: "até 60 dias", onde: "liderança das áreas críticas", como: "treinamentos, mentoria e avaliação 360", indicador: "aumento do Índice de Liderança Saudável" },
  seguranca: { oQue: "Fortalecer canais de escuta e cultura de segurança psicológica", porQue: "Permitir que as pessoas opinem, errem e peçam ajuda sem medo", quem: "RH e liderança", quando: "até 45 dias", onde: "toda a organização", como: "rodas de conversa, canal confidencial e reforço de conduta", indicador: "aumento do Índice de Segurança Psicológica" },
  bem_estar: { oQue: "Programa de apoio psicológico e qualidade de vida", porQue: "Preservar a saúde mental e o equilíbrio vida-trabalho", quem: "RH / Saúde Ocupacional", quando: "até 45 dias", onde: "toda a organização", como: "apoio psicológico, pausas, gestão de jornada", indicador: "aumento do Índice de Bem-Estar Emocional" },
  conduta: { oQue: "Reforçar política antiassédio e canal de denúncia", porQue: "Eliminar condutas inadequadas e proteger as pessoas", quem: "RH, Jurídico e Compliance", quando: "imediato / até 15 dias", onde: "toda a organização", como: "política, treinamento obrigatório e apuração confidencial", indicador: "redução de relatos sensíveis e aumento do Índice de Conduta" },
  engajamento: { oQue: "Plano de reconhecimento e desenvolvimento de carreira", porQue: "Reduzir risco de desengajamento e rotatividade", quem: "RH e lideranças", quando: "até 60 dias", onde: "áreas com baixo engajamento", como: "reconhecimento, trilhas de carreira e feedback", indicador: "aumento do Índice de Engajamento e do eNPS" },
  pulso: { oQue: "Ações rápidas de clima e escuta da equipe", porQue: "Reverter o estado emocional negativo identificado", quem: "Liderança direta com apoio do RH", quando: "até 15 dias", onde: "equipes com pulso baixo", como: "conversa individual, ajustes rápidos e acompanhamento semanal", indicador: "melhora do Índice de Pulso Emocional" },
};

export async function suggestActionPlans(surveyId: string): Promise<Plan5W2H[]> {
  const scores = await surveyScores(surveyId);
  if (scores.responses < MIN_RESPONSES) return [];
  return scores.dimensions
    .filter((d) => d.classification === "alto" || d.classification === "atencao")
    .map((d) => {
      const tpl = PLAN_TEMPLATES[d.key];
      if (!tpl) return null;
      return { dimension: d.label, risco: `${d.label} (${d.score} — ${CLASS_LABEL[d.classification]})`, ...tpl };
    })
    .filter(Boolean) as Plan5W2H[];
}

// ---- Relatório executivo --------------------------------------------------
export async function surveyExecutiveReport(organizationId: string, surveyId: string) {
  const survey = await prisma.survey.findFirst({
    where: { id: surveyId, organizationId },
    select: { title: true, anonymous: true, type: true },
  });
  if (!survey) return null;
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } });
  const [scores, alerts, open, plans] = await Promise.all([
    surveyScores(surveyId),
    surveyAlerts(surveyId),
    analyzeOpenAnswers(surveyId),
    suggestActionPlans(surveyId),
  ]);
  const strong = scores.dimensions.filter((d) => d.score >= 70).slice(-5).reverse();
  const critical = scores.dimensions.filter((d) => d.score < 70);
  return { org: org?.name ?? "", survey, scores, alerts, open, plans, strong, critical, generatedAt: new Date() };
}
