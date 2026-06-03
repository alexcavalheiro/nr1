import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ensureDb } from "@/src/db";
import { getFlowDetail } from "@/src/index";
import { canManage, requireSession } from "../../lib/auth";
import { AppShell } from "../../components/AppShell";
import { ACTION_LABEL, EVENT_LABEL } from "../page";
import { addActionAction, removeActionAction, toggleFlowAction } from "../actions";

export const dynamic = "force-dynamic";

const RUN_BADGE: Record<string, string> = { SUCCESS: "LOW", FAILED: "CRITICAL", RUNNING: "MODERATE", PENDING: "HIGH" };
const RUN_LABEL: Record<string, string> = { SUCCESS: "Sucesso", FAILED: "Falha", RUNNING: "Executando", PENDING: "Pendente" };

export default async function FlowDetail({ params }: { params: Promise<{ id: string }> }) {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) redirect("/dashboard");
  const { id } = await params;
  const flow = await getFlowDetail(session.organizationId, id);
  if (!flow) notFound();

  return (
    <AppShell session={session} active="automations" title={flow.name} subtitle="Configuração do fluxo de automação" showReport={false}>
      <Link href="/automations" className="nav-link">← Voltar às automações</Link>

      <div className="card" style={{ margin: "14px 0 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="stat-label">Gatilho</div>
            <strong>Quando: {EVENT_LABEL[flow.triggerEvent] ?? flow.triggerEvent}</strong>
          </div>
          <form action={toggleFlowAction}>
            <input type="hidden" name="id" value={flow.id} />
            <input type="hidden" name="enabled" value={(!flow.enabled).toString()} />
            <button className="btn-ghost btn-sm" type="submit">{flow.enabled ? "Pausar fluxo" : "Ativar fluxo"}</button>
          </form>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Ações (então…) — {flow.actions.length}</h2>
          {flow.actions.length === 0 ? (
            <p className="stat-label">Adicione ações que serão executadas quando o gatilho ocorrer.</p>
          ) : (
            <ul className="insights">
              {flow.actions.map((a, i) => (
                <li key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span><span className="stat-label">{i + 1}.</span> {ACTION_LABEL[a.type] ?? a.type}</span>
                  <form action={removeActionAction}>
                    <input type="hidden" name="flowId" value={flow.id} />
                    <input type="hidden" name="actionId" value={a.id} />
                    <button className="btn-ghost btn-sm" type="submit">Remover</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={addActionAction} className="form-row" style={{ marginTop: 14 }}>
            <input type="hidden" name="flowId" value={flow.id} />
            <select name="type" required style={{ flex: 1 }}>
              {Object.entries(ACTION_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input name="title" placeholder="Título (opcional)" style={{ flex: 1 }} />
            <button className="btn" style={{ width: "auto" }} type="submit">Adicionar ação</button>
          </form>
        </div>

        <div className="card">
          <h2>Execuções recentes</h2>
          {flow.runs.length === 0 ? (
            <p className="stat-label">Nenhuma execução ainda. O fluxo roda quando o gatilho ocorre.</p>
          ) : (
            <table>
              <thead><tr><th>Quando</th><th>Evento</th><th>Status</th></tr></thead>
              <tbody>
                {flow.runs.map((r) => (
                  <tr key={r.id}>
                    <td className="stat-label">{new Date(r.startedAt).toLocaleString("pt-BR")}</td>
                    <td className="stat-label">{r.event ? EVENT_LABEL[r.event.type] ?? r.event.type : "—"}</td>
                    <td><span className={`badge ${RUN_BADGE[r.status] ?? "MODERATE"}`}>{RUN_LABEL[r.status] ?? r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
