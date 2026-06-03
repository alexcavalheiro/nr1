import { ensureDb } from "@/src/db";
import { getAlerts, getIndicators } from "@/src/index";
import { canManage, requireSession } from "../lib/auth";
import { AppShell } from "../components/AppShell";
import { recordIndicatorAction, resolveAlertAction, runChecksAction } from "./actions";

export const dynamic = "force-dynamic";

const IND_LABEL: Record<string, string> = {
  CLIMATE: "Clima", ENGAGEMENT: "Engajamento", TURNOVER: "Rotatividade", ABSENTEEISM: "Absenteísmo",
  MEDICAL_LEAVE: "Afastamentos", PARTICIPATION: "Participação", ORG_HEALTH_INDEX: "Índice de saúde org.",
  PSYCHOSOCIAL_RISK_INDEX: "Índice de risco psicossocial", LEADERSHIP_INDEX: "Índice de liderança",
};
const ALERT_LABEL: Record<string, string> = {
  CRITICAL_RISK: "Risco crítico", ENGAGEMENT_DROP: "Queda de engajamento", COMPLAINTS_RISE: "Aumento de denúncias",
  LOW_ADOPTION: "Baixa adesão", OVERDUE_PLAN: "Plano vencido",
};
const SEV_LABEL: Record<string, string> = { LOW: "Baixo", MODERATE: "Moderado", HIGH: "Alto", CRITICAL: "Crítico" };

export default async function MonitoringPage() {
  await ensureDb();
  const session = await requireSession();
  const manage = canManage(session.role);
  const [indicators, alerts] = await Promise.all([getIndicators(session.organizationId), getAlerts(session.organizationId)]);
  const withData = indicators.filter((i) => i.value !== null);
  const openAlerts = alerts.filter((a) => !a.resolved);

  return (
    <AppShell session={session} active="monitoring" title="Monitoramento" subtitle="Indicadores, evolução e alertas">
        <h2 className="section-title" style={{ marginTop: 0 }}>Indicadores e reavaliação</h2>

        {/* Indicadores */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2>Indicadores ({withData.length})</h2>
          {withData.length === 0 ? (
            <p className="stat-label">Nenhum indicador registrado ainda.</p>
          ) : (
            <table>
              <thead><tr><th>Indicador</th><th>Valor atual</th><th>Variação</th><th>Período</th></tr></thead>
              <tbody>
                {withData.map((i) => (
                  <tr key={i.type}>
                    <td>{IND_LABEL[i.type] ?? i.type}</td>
                    <td><strong>{i.value}</strong></td>
                    <td style={{ color: i.deltaPct == null ? "var(--muted)" : i.deltaPct < 0 ? "var(--critical)" : "var(--low)" }}>
                      {i.deltaPct == null ? "—" : `${i.deltaPct > 0 ? "▲" : "▼"} ${Math.abs(i.deltaPct)}%`}
                    </td>
                    <td className="muted">{i.at ? new Date(i.at).toLocaleDateString("pt-BR") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {manage && (
            <form action={recordIndicatorAction} className="form-row" style={{ marginTop: 14 }}>
              <select name="type" required>
                {Object.entries(IND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input name="value" type="number" step="any" placeholder="Valor" required style={{ width: 120 }} />
              <input name="periodEnd" type="date" />
              <button className="btn" style={{ width: "auto" }} type="submit">Registrar</button>
            </form>
          )}
        </div>

        {/* Alertas */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>Alertas ({openAlerts.length} abertos)</h2>
            {manage && (
              <form action={runChecksAction}>
                <button className="btn btn-ghost" type="submit">Verificar alertas agora</button>
              </form>
            )}
          </div>
          {alerts.length === 0 ? (
            <p className="stat-label">Nenhum alerta.</p>
          ) : (
            <ul className="insights">
              {alerts.map((a) => (
                <li key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", opacity: a.resolved ? 0.5 : 1 }}>
                  <span>
                    <span className={`badge ${a.severity}`}>{SEV_LABEL[a.severity] ?? a.severity}</span>{" "}
                    <strong>{ALERT_LABEL[a.type] ?? a.type}</strong> — {a.message}
                    {a.resolved && <span className="muted"> · resolvido</span>}
                  </span>
                  {manage && !a.resolved && (
                    <form action={resolveAlertAction}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className="btn btn-ghost" type="submit">Resolver</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
    </AppShell>
  );
}
