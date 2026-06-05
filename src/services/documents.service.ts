import { DocumentType, ExportFormat } from "@prisma/client";
import { prisma } from "../db";

// =============================================================================
// SERVIÇO DE DOCUMENTAÇÃO E GRO — Módulo 7 (Fase 6 NR-1).
// Monta Inventário de Riscos e Relatório NR-1 consolidados; gera CSV nativo;
// registra histórico de documentos gerados (auditável).
// =============================================================================

const LEVEL_LABEL: Record<string, string> = { LOW: "Baixo", MODERATE: "Moderado", HIGH: "Alto", CRITICAL: "Crítico" };
const STATUS_LABEL: Record<string, string> = {
  IDENTIFIED: "Identificado", ASSESSED: "Avaliado", PRIORITIZED: "Priorizado",
  IN_TREATMENT: "Em tratamento", MONITORED: "Monitorado", CLOSED: "Encerrado",
};

export interface InventoryRow {
  risco: string; categoria: string; setor: string; status: string;
  probabilidade: number | ""; impacto: number | ""; score: number | "";
  classificacao: string; scorePrioridade: number | ""; ranking: number | "";
  planos: number; fontes: number;
}

/** Inventário de riscos consolidado (linhas tabulares, ordenadas por prioridade). */
export async function buildRiskInventory(organizationId: string): Promise<InventoryRow[]> {
  const risks = await prisma.risk.findMany({
    where: { organizationId },
    include: {
      category: { select: { name: true } },
      department: { select: { name: true } },
      assessments: { where: { isCurrent: true }, take: 1 },
      prioritization: true,
      _count: { select: { actionPlans: true, sources: true } },
    },
  });

  const rows = risks.map((r) => {
    const a = r.assessments[0];
    return {
      risco: r.title,
      categoria: r.category.name,
      setor: r.department?.name ?? "Corporativo",
      status: STATUS_LABEL[r.status] ?? r.status,
      probabilidade: a?.probability ?? "",
      impacto: a?.impact ?? "",
      score: a?.score ?? "",
      classificacao: a ? LEVEL_LABEL[a.classification] : "",
      scorePrioridade: r.prioritization?.priorityScore ?? "",
      ranking: r.prioritization?.rank ?? "",
      planos: r._count.actionPlans,
      fontes: r._count.sources,
    } satisfies InventoryRow;
  });

  // Ordena por ranking (priorizados primeiro), depois por score desc.
  return rows.sort((x, y) => {
    const rx = x.ranking === "" ? Infinity : x.ranking;
    const ry = y.ranking === "" ? Infinity : y.ranking;
    if (rx !== ry) return rx - ry;
    return (Number(y.score) || 0) - (Number(x.score) || 0);
  });
}

/** Relatório NR-1 consolidado (estrutura para página imprimível / payload). */
export async function buildNr1Report(organizationId: string) {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
  const inventory = await buildRiskInventory(organizationId);

  const countsByLevel = { Baixo: 0, Moderado: 0, Alto: 0, Crítico: 0 } as Record<string, number>;
  for (const r of inventory) if (r.classificacao) countsByLevel[r.classificacao]++;

  const [plansByStatus, openAlerts, manifestations, surveys] = await Promise.all([
    prisma.actionPlan.groupBy({ by: ["status"], where: { organizationId }, _count: true }),
    prisma.alert.count({ where: { organizationId, resolved: false } }),
    prisma.manifestation.count({ where: { organizationId } }),
    prisma.survey.count({ where: { organizationId } }),
  ]);

  return {
    organization: org.name,
    generatedAt: new Date(),
    totals: {
      riscos: inventory.length,
      avaliados: inventory.filter((r) => r.score !== "").length,
      priorizados: inventory.filter((r) => r.ranking !== "").length,
      pesquisas: surveys,
      manifestacoes: manifestations,
      alertasAbertos: openAlerts,
    },
    countsByLevel,
    plansByStatus: Object.fromEntries(plansByStatus.map((p) => [p.status, p._count])),
    topRiscos: inventory.filter((r) => r.ranking !== "").slice(0, 10),
  };
}

/** Serializa linhas em CSV (nativo, sem dependências). */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(";"), ...rows.map((r) => headers.map((h) => esc(r[h])).join(";"))];
  return "﻿" + lines.join("\n"); // BOM p/ acentuação no Excel
}

export async function recordGeneratedDocument(
  organizationId: string,
  type: DocumentType,
  format: ExportFormat,
  payload: unknown,
  generatedById?: string,
) {
  return prisma.generatedDocument.create({
    data: {
      organizationId,
      type,
      format,
      generatedById,
      payload: payload as never,
    },
  });
}

export async function listGeneratedDocuments(organizationId: string) {
  return prisma.generatedDocument.findMany({
    where: { organizationId },
    orderBy: { generatedAt: "desc" },
    take: 30,
  });
}

/** Registra manualmente um documento (título + link/referência) no acervo do GRO. */
export async function addManualDocument(
  organizationId: string,
  input: { title: string; fileUrl?: string; type?: DocumentType; note?: string },
  generatedById?: string,
) {
  const title = input.title.trim();
  if (!title) throw new Error("Título do documento é obrigatório.");
  return prisma.generatedDocument.create({
    data: {
      organizationId,
      type: input.type ?? DocumentType.EVIDENCE_PACKAGE,
      format: ExportFormat.PDF,
      fileUrl: input.fileUrl?.trim() || null,
      generatedById,
      payload: { manual: true, title, note: input.note?.trim() || null },
    },
  });
}

export async function updateManualDocument(
  documentId: string,
  organizationId: string,
  input: { title: string; fileUrl?: string; note?: string },
) {
  const doc = await prisma.generatedDocument.findFirst({ where: { id: documentId, organizationId } });
  if (!doc) throw new Error("Documento não encontrado.");
  const title = input.title.trim();
  if (!title) throw new Error("Título do documento é obrigatório.");
  return prisma.generatedDocument.update({
    where: { id: documentId },
    data: {
      fileUrl: input.fileUrl?.trim() || null,
      payload: { manual: true, title, note: input.note?.trim() || null },
    },
  });
}

export async function deleteDocument(documentId: string, organizationId: string) {
  const doc = await prisma.generatedDocument.findFirst({ where: { id: documentId, organizationId } });
  if (!doc) throw new Error("Documento não encontrado.");
  return prisma.generatedDocument.delete({ where: { id: documentId } });
}
