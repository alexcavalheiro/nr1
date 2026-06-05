import { redirect } from "next/navigation";
import { ensureDb } from "@/src/db";
import { listGeneratedDocuments } from "@/src/index";
import { canManage, canViewDocs, requireSession } from "../lib/auth";
import { AppShell } from "../components/AppShell";
import { addDocumentAction, deleteDocumentAction, generateReportAction, updateDocumentAction } from "./actions";

export const dynamic = "force-dynamic";

const DOC_LABEL: Record<string, string> = {
  RISK_INVENTORY: "Inventário de riscos", NR1_REPORT: "Relatório NR-1",
  ASSESSMENT_HISTORY: "Histórico de avaliações", EVIDENCE_PACKAGE: "Evidências", CONSOLIDATED_PLAN: "Plano consolidado",
};

type DocPayload = { manual?: boolean; title?: string; note?: string | null } | null;

export default async function DocumentsPage() {
  await ensureDb();
  const session = await requireSession();
  if (!canViewDocs(session.role)) redirect("/dashboard");
  const manage = canManage(session.role);
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

        {manage && (
          <>
            <h3 className="section-title">Adicionar documento</h3>
            <div className="card">
              <form action={addDocumentAction} className="form-row">
                <input name="title" placeholder="Título do documento" required style={{ flex: 1 }} />
                <input name="fileUrl" placeholder="Link / referência (opcional)" style={{ flex: 1 }} />
                <input name="note" placeholder="Observação (opcional)" style={{ flex: 1 }} />
                <button className="btn" style={{ width: "auto" }} type="submit">Adicionar</button>
              </form>
            </div>
          </>
        )}

        <h3 className="section-title">Documentos ({docs.length})</h3>
        <div className="card">
          {docs.length === 0 ? (
            <p className="stat-label">Nenhum documento ainda.</p>
          ) : (
            <table>
              <thead><tr><th>Documento</th><th>Formato</th><th>Gerado em</th>{manage && <th></th>}</tr></thead>
              <tbody>
                {docs.map((d) => {
                  const payload = d.payload as DocPayload;
                  const isManual = payload?.manual === true;
                  const name = isManual ? payload?.title ?? "Documento" : DOC_LABEL[d.type] ?? d.type;
                  return (
                    <tr key={d.id}>
                      <td>
                        {d.fileUrl ? <a href={d.fileUrl} target="_blank" rel="noreferrer">{name}</a> : name}
                        {payload?.note && <div className="stat-label">{payload.note}</div>}
                      </td>
                      <td className="muted">{isManual ? "Manual" : d.format}</td>
                      <td className="muted">{new Date(d.generatedAt).toLocaleString("pt-BR")}</td>
                      {manage && (
                        <td>
                          {isManual && (
                            <div className="form-row">
                              <details>
                                <summary className="btn-ghost btn-sm" style={{ display: "inline-block", cursor: "pointer" }}>Editar</summary>
                                <form action={updateDocumentAction} style={{ marginTop: 8 }}>
                                  <input type="hidden" name="id" value={d.id} />
                                  <input name="title" defaultValue={payload?.title ?? ""} placeholder="Título" required style={{ width: "100%", marginBottom: 6 }} />
                                  <input name="fileUrl" defaultValue={d.fileUrl ?? ""} placeholder="Link / referência" style={{ width: "100%", marginBottom: 6 }} />
                                  <input name="note" defaultValue={payload?.note ?? ""} placeholder="Observação" style={{ width: "100%", marginBottom: 6 }} />
                                  <button className="btn btn-sm" style={{ width: "auto" }} type="submit">Salvar</button>
                                </form>
                              </details>
                              <form action={deleteDocumentAction}>
                                <input type="hidden" name="id" value={d.id} />
                                <button className="btn-ghost btn-sm" type="submit">Excluir</button>
                              </form>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
    </AppShell>
  );
}
