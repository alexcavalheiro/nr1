import { redirect } from "next/navigation";
import { ensureDb } from "@/src/db";
import { listGeneratedDocuments } from "@/src/index";
import { canViewDocs, requireSession } from "../lib/auth";
import { AppShell } from "../components/AppShell";
import { generateReportAction } from "./actions";

export const dynamic = "force-dynamic";

const DOC_LABEL: Record<string, string> = {
  RISK_INVENTORY: "Inventário de riscos", NR1_REPORT: "Relatório NR-1",
  ASSESSMENT_HISTORY: "Histórico de avaliações", EVIDENCE_PACKAGE: "Evidências", CONSOLIDATED_PLAN: "Plano consolidado",
};

export default async function DocumentsPage() {
  await ensureDb();
  const session = await requireSession();
  if (!canViewDocs(session.role)) redirect("/dashboard");
  const docs = await listGeneratedDocuments(session.organizationId);

  return (
    <AppShell session={session} active="documents" title="Documentação e GRO" subtitle="Inventário e relatórios NR-1">
        <h2 className="section-title" style={{ marginTop: 0 }}>Exportações e relatórios</h2>

        <div className="grid-2">
          <div className="card">
            <h2>Inventário de riscos</h2>
            <p className="stat-label">Exportação tabular de todos os riscos com avaliação e priorização.</p>
            <div className="form-row" style={{ marginTop: 8 }}>
              <a className="btn" style={{ width: "auto", textDecoration: "none", padding: "9px 14px" }} href="/documents/export?format=xlsx">Baixar Excel (.xlsx)</a>
              <a className="btn btn-ghost" style={{ textDecoration: "none" }} href="/documents/export?format=csv">Baixar CSV</a>
            </div>
          </div>
          <div className="card">
            <h2>Relatório NR-1</h2>
            <p className="stat-label">Relatório consolidado para o GRO — abre em versão imprimível (salve como PDF).</p>
            <form action={generateReportAction} style={{ marginTop: 8 }}>
              <button className="btn" style={{ width: "auto" }} type="submit">Gerar relatório NR-1 →</button>
            </form>
          </div>
        </div>

        <h3 className="section-title">Documentos gerados ({docs.length})</h3>
        <div className="card">
          {docs.length === 0 ? (
            <p className="stat-label">Nenhum documento gerado ainda.</p>
          ) : (
            <table>
              <thead><tr><th>Documento</th><th>Formato</th><th>Gerado em</th></tr></thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id}>
                    <td>{DOC_LABEL[d.type] ?? d.type}</td>
                    <td className="muted">{d.format}</td>
                    <td className="muted">{new Date(d.generatedAt).toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
    </AppShell>
  );
}
