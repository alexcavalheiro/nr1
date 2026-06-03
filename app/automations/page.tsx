import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureDb } from "@/src/db";
import { listFlows } from "@/src/index";
import { canManage, requireSession } from "../lib/auth";
import { AppShell } from "../components/AppShell";
import { createFlowAction } from "./actions";

export const dynamic = "force-dynamic";

export const EVENT_LABEL: Record<string, string> = {
  NEW_SURVEY: "Nova pesquisa", NEW_MANIFESTATION: "Nova manifestação", NEW_RISK: "Novo risco",
  RISK_CHANGED: "Alteração de risco", OVERDUE_PLAN: "Plano vencido", NEW_EMPLOYEE: "Novo colaborador",
  INDICATOR_CHANGE: "Mudança de indicador", CRITICAL_RISK_DETECTED: "Risco crítico detectado",
};
export const ACTION_LABEL: Record<string, string> = {
  NOTIFY_HR: "Notificar RH", NOTIFY_MANAGER: "Notificar gestor", CREATE_ACTION_PLAN: "Criar plano de ação",
  REGISTER_INCIDENT: "Registrar ocorrência", TRIGGER_AI_AGENT: "Acionar agente de IA", CLASSIFY: "Classificar",
  CREATE_PROTOCOL: "Criar protocolo", WRITE_AUDIT_LOG: "Registrar auditoria", SEND_ALERT: "Enviar alerta",
  ESCALATE: "Escalar para gestor", UPDATE_DASHBOARD: "Atualizar dashboard", CALL_WEBHOOK: "Disparar webhook",
  CALL_INTEGRATION: "Acionar integração",
};

export default async function AutomationsPage() {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) redirect("/dashboard");
  const flows = await listFlows(session.organizationId);

  return (
    <AppShell session={session} active="automations" title="Automações" subtitle="Orquestrador de fluxos — Quando X, então Y" showReport={false}>
      <div className="card" style={{ marginBottom: 20 }}>
        <h2>Novo fluxo de automação</h2>
        <form action={createFlowAction} className="form-row">
          <input name="name" placeholder="Nome do fluxo" required style={{ flex: 2 }} />
          <select name="triggerEvent" required>
            {Object.entries(EVENT_LABEL).map(([v, l]) => <option key={v} value={v}>Quando: {l}</option>)}
          </select>
          <button className="btn" style={{ width: "auto" }} type="submit">Criar fluxo</button>
        </form>
      </div>

      <div className="card">
        <h2>Fluxos ({flows.length})</h2>
        {flows.length === 0 ? (
          <p className="stat-label">Nenhum fluxo criado.</p>
        ) : (
          <table>
            <thead><tr><th>Fluxo</th><th>Gatilho</th><th>Ações</th><th>Execuções</th><th>Status</th></tr></thead>
            <tbody>
              {flows.map((f) => (
                <tr key={f.id}>
                  <td><Link href={`/automations/${f.id}`}>{f.name}</Link></td>
                  <td className="stat-label">{EVENT_LABEL[f.triggerEvent] ?? f.triggerEvent}</td>
                  <td>{f._count.actions}</td>
                  <td>{f._count.runs}</td>
                  <td>{f.enabled ? <span className="badge LOW">Ativo</span> : <span className="badge CRITICAL">Pausado</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
