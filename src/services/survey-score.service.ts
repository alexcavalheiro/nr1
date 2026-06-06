import { prisma } from "../db";

// =============================================================================
// MOTOR DE PONTUAÇÃO POR DIMENSÃO (0–100) para o diagnóstico psicossocial.
// - Likert 1..5 → 0..100; perguntas reversas (negativas) têm o score invertido.
// - Pulso (escolha única) mapeado para 0..100.
// - eNPS calculado à parte (promotores% − detratores%).
// - Índice Geral = média das dimensões; Risco Psicossocial = inverso.
// =============================================================================

export const DIMENSION_LABELS: Record<string, string> = {
  pulso: "Pulso Emocional",
  bem_estar: "Bem-Estar Emocional",
  sobrecarga: "Sobrecarga e Pressão",
  seguranca: "Segurança Psicológica",
  lideranca: "Liderança Saudável",
  conduta: "Conduta e Respeito",
  engajamento: "Engajamento",
};

const PULSO_SCORE: Record<string, number> = {
  "Muito bem": 100, Bem: 80, Neutro: 60, Desanimado: 40, Sobrecarregado: 20, Exausto: 0,
};

export type Classification = "alto" | "atencao" | "saudavel" | "excelente";

export function classify(score: number): Classification {
  if (score < 50) return "alto";
  if (score < 70) return "atencao";
  if (score < 85) return "saudavel";
  return "excelente";
}
export const CLASS_LABEL: Record<Classification, string> = {
  alto: "Risco alto", atencao: "Atenção", saudavel: "Saudável", excelente: "Excelente",
};

const normLikert = (v: number, reverse: boolean) => {
  const n = ((Math.min(5, Math.max(1, v)) - 1) / 4) * 100;
  return reverse ? 100 - n : n;
};

export async function surveyScores(surveyId: string) {
  const [responses, answers] = await Promise.all([
    prisma.surveyResponse.count({ where: { surveyId } }),
    prisma.surveyAnswer.findMany({
      where: { response: { surveyId } },
      select: {
        valueNumber: true,
        valueOption: true,
        question: { select: { dimension: true, reverseScored: true, type: true, weight: true } },
      },
    }),
  ]);

  const buckets = new Map<string, { sum: number; weight: number }>();
  const add = (dim: string, score: number, w: number) => {
    const b = buckets.get(dim) ?? { sum: 0, weight: 0 };
    b.sum += score * w;
    b.weight += w;
    buckets.set(dim, b);
  };
  const enps: number[] = [];

  for (const a of answers) {
    const q = a.question;
    const dim = q.dimension;
    if (!dim) continue;
    const w = q.weight || 1;
    if (dim === "enps") {
      if (a.valueNumber != null) enps.push(a.valueNumber);
    } else if (q.type === "LIKERT_5" && a.valueNumber != null) {
      add(dim, normLikert(a.valueNumber, q.reverseScored), w);
    } else if (dim === "pulso" && a.valueOption && a.valueOption in PULSO_SCORE) {
      add(dim, PULSO_SCORE[a.valueOption], w);
    } else if (q.type === "SCALE_0_10" && a.valueNumber != null) {
      add(dim, (a.valueNumber / 10) * 100, w);
    }
  }

  const dimensions = [...buckets.entries()]
    .filter(([, b]) => b.weight > 0)
    .map(([key, b]) => {
      const score = Math.round(b.sum / b.weight);
      return { key, label: DIMENSION_LABELS[key] ?? key, score, classification: classify(score) };
    })
    .sort((a, b) => a.score - b.score);

  const generalScore = dimensions.length
    ? Math.round(dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length)
    : 0;

  // eNPS
  let enpsResult: { value: number; promoters: number; neutros: number; detractors: number } | null = null;
  if (enps.length) {
    const promoters = enps.filter((v) => v >= 9).length;
    const detractors = enps.filter((v) => v <= 6).length;
    const neutros = enps.length - promoters - detractors;
    const value = Math.round((promoters / enps.length) * 100 - (detractors / enps.length) * 100);
    enpsResult = { value, promoters, neutros, detractors };
  }

  return {
    responses,
    dimensions,
    general: { score: generalScore, classification: classify(generalScore) },
    riskGeneral: { score: 100 - generalScore, classification: classify(100 - generalScore) },
    enps: enpsResult,
  };
}
