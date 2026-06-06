import { prisma } from "../db";
import { surveyScores, classify, DIMENSION_LABELS, type Classification } from "./survey-score.service";

// =============================================================================
// FASE 3 — Gestão avançada: mapa de calor por setor e comparativo histórico.
// =============================================================================

const MIN = 5; // anonimato por recorte

const PULSO_SCORE: Record<string, number> = {
  "Muito bem": 100, Bem: 80, Neutro: 60, Desanimado: 40, Sobrecarregado: 20, Exausto: 0,
};
const normLikert = (v: number, reverse: boolean) => {
  const n = ((Math.min(5, Math.max(1, v)) - 1) / 4) * 100;
  return reverse ? 100 - n : n;
};

export interface HeatCell { dimension: string; label: string; score: number; classification: Classification }
export interface HeatRow { departmentId: string; name: string; responses: number; cells: HeatCell[]; general: number }

/** Mapa de calor: dimensões × setor (só setores com ≥ MIN respostas). */
export async function surveyHeatmap(surveyId: string): Promise<{ dimensions: { key: string; label: string }[]; rows: HeatRow[] }> {
  const [responses, answers] = await Promise.all([
    prisma.surveyResponse.findMany({ where: { surveyId, departmentId: { not: null } }, select: { departmentId: true } }),
    prisma.surveyAnswer.findMany({
      where: { response: { surveyId, departmentId: { not: null } }, question: { dimension: { not: null } } },
      select: { valueNumber: true, valueOption: true, response: { select: { departmentId: true } }, question: { select: { dimension: true, reverseScored: true, type: true, weight: true } } },
    }),
  ]);

  const respByDept = new Map<string, number>();
  for (const r of responses) respByDept.set(r.departmentId!, (respByDept.get(r.departmentId!) ?? 0) + 1);

  // bucket[dept][dim] = { sum, weight }
  const bucket = new Map<string, Map<string, { sum: number; weight: number }>>();
  for (const a of answers) {
    const dept = a.response.departmentId!;
    const dim = a.question.dimension!;
    if (dim === "enps") continue;
    let score: number | null = null;
    const w = a.question.weight || 1;
    if (a.question.type === "LIKERT_5" && a.valueNumber != null) score = normLikert(a.valueNumber, a.question.reverseScored);
    else if (dim === "pulso" && a.valueOption && a.valueOption in PULSO_SCORE) score = PULSO_SCORE[a.valueOption];
    if (score == null) continue;
    if (!bucket.has(dept)) bucket.set(dept, new Map());
    const dm = bucket.get(dept)!;
    const b = dm.get(dim) ?? { sum: 0, weight: 0 };
    b.sum += score * w; b.weight += w; dm.set(dim, b);
  }

  const dimsPresent = new Set<string>();
  for (const dm of bucket.values()) for (const k of dm.keys()) dimsPresent.add(k);
  const dimensions = Object.keys(DIMENSION_LABELS).filter((k) => dimsPresent.has(k)).map((k) => ({ key: k, label: DIMENSION_LABELS[k] }));

  const deptIds = [...bucket.keys()].filter((id) => (respByDept.get(id) ?? 0) >= MIN);
  const depts = await prisma.department.findMany({ where: { id: { in: deptIds } }, select: { id: true, name: true } });
  const nameById = new Map(depts.map((d) => [d.id, d.name]));

  const rows: HeatRow[] = deptIds.map((id) => {
    const dm = bucket.get(id)!;
    const cells: HeatCell[] = dimensions.map((d) => {
      const b = dm.get(d.key);
      const score = b && b.weight ? Math.round(b.sum / b.weight) : 0;
      return { dimension: d.key, label: d.label, score, classification: classify(score) };
    });
    const general = cells.length ? Math.round(cells.reduce((s, c) => s + c.score, 0) / cells.length) : 0;
    return { departmentId: id, name: nameById.get(id) ?? "Setor", responses: respByDept.get(id) ?? 0, cells, general };
  }).sort((a, b) => a.general - b.general);

  return { dimensions, rows };
}

/** Comparativo histórico: índice geral e respostas por pesquisa (linha do tempo). */
export async function surveyHistory(organizationId: string, opts: { type?: string } = {}) {
  const surveys = await prisma.survey.findMany({
    where: { organizationId, ...(opts.type ? { type: opts.type as never } : {}), status: { not: "DRAFT" } },
    select: { id: true, title: true, type: true, createdAt: true, _count: { select: { responses: true } } },
    orderBy: { createdAt: "asc" },
  });
  const withResponses = surveys.filter((s) => s._count.responses > 0);
  const points = await Promise.all(
    withResponses.map(async (s) => {
      const sc = await surveyScores(s.id);
      return {
        id: s.id, title: s.title, type: s.type, createdAt: s.createdAt,
        responses: sc.responses,
        general: sc.responses >= MIN ? sc.general.score : null,
        enps: sc.responses >= MIN ? sc.enps?.value ?? null : null,
        dimensions: sc.responses >= MIN ? sc.dimensions : [],
      };
    }),
  );
  return points;
}
