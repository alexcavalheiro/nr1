import { ensureDb } from "@/src/db";
import { buildRiskInventory, recordGeneratedDocument, toCsv } from "@/src/index";
import { canViewDocs, getSession } from "../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLUMNS: { header: string; key: string }[] = [
  { header: "Risco", key: "risco" },
  { header: "Categoria", key: "categoria" },
  { header: "Setor", key: "setor" },
  { header: "Status", key: "status" },
  { header: "Probabilidade", key: "probabilidade" },
  { header: "Impacto", key: "impacto" },
  { header: "Score", key: "score" },
  { header: "Classificação", key: "classificacao" },
  { header: "Score prioridade", key: "scorePrioridade" },
  { header: "Ranking", key: "ranking" },
  { header: "Planos", key: "planos" },
  { header: "Fontes", key: "fontes" },
];

// GET /documents/export?format=csv|xlsx — Inventário de Riscos (Módulo 7).
export async function GET(req: Request) {
  await ensureDb();
  const session = await getSession();
  if (!session || !canViewDocs(session.role)) {
    return new Response("Não autorizado", { status: 403 });
  }

  const format = new URL(req.url).searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const rows = await buildRiskInventory(session.organizationId);

  if (format === "xlsx") {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Inventário de Riscos");
    ws.columns = COLUMNS.map((c) => ({ ...c, width: 18 }));
    rows.forEach((r) => ws.addRow(r));
    ws.getRow(1).font = { bold: true };
    const buf = await wb.xlsx.writeBuffer();
    await recordGeneratedDocument(session.organizationId, "RISK_INVENTORY", "XLSX", { linhas: rows.length }, session.userId);
    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="inventario-riscos.xlsx"',
      },
    });
  }

  // Rótulos legíveis no cabeçalho (mesmas colunas do XLSX).
  const labeled = rows.map((r) =>
    Object.fromEntries(COLUMNS.map((c) => [c.header, (r as unknown as Record<string, unknown>)[c.key]])),
  );
  const csv = toCsv(labeled);
  await recordGeneratedDocument(session.organizationId, "RISK_INVENTORY", "CSV", { linhas: rows.length }, session.userId);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="inventario-riscos.csv"',
    },
  });
}
