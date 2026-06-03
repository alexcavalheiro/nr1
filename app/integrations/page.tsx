import { redirect } from "next/navigation";
import { ensureDb } from "@/src/db";
import { listIntegrations, listWebhooks } from "@/src/index";
import { canManage, requireSession } from "../lib/auth";
import { AppShell } from "../components/AppShell";
import { connectAction, createWebhookAction, deleteWebhookAction, disconnectAction } from "./actions";

export const dynamic = "force-dynamic";

const PROVIDERS: { id: string; label: string; key?: boolean }[] = [
  { id: "N8N", label: "n8n" }, { id: "OPENAI", label: "OpenAI", key: true }, { id: "CLAUDE", label: "Claude", key: true },
  { id: "GEMINI", label: "Gemini", key: true }, { id: "MS_COPILOT", label: "Microsoft Copilot" }, { id: "WHATSAPP_BUSINESS", label: "WhatsApp Business" },
  { id: "MS_TEAMS", label: "Microsoft Teams" }, { id: "SLACK", label: "Slack" }, { id: "GOOGLE_WORKSPACE", label: "Google Workspace" },
  { id: "OUTLOOK", label: "Outlook" }, { id: "POWER_BI", label: "Power BI" }, { id: "LOOKER_STUDIO", label: "Looker Studio" },
  { id: "ZAPIER", label: "Zapier" }, { id: "MAKE", label: "Make.com" },
];
const EVENTS: Record<string, string> = {
  NEW_RISK: "Novo risco", CRITICAL_RISK_DETECTED: "Risco crítico", NEW_MANIFESTATION: "Nova manifestação",
  OVERDUE_PLAN: "Plano vencido", NEW_SURVEY: "Nova pesquisa", INDICATOR_CHANGE: "Mudança de indicador",
};

export default async function IntegrationsPage() {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) redirect("/dashboard");
  const [integrations, webhooks] = await Promise.all([listIntegrations(session.organizationId), listWebhooks(session.organizationId)]);
  const statusOf = (id: string) => integrations.find((i) => i.provider === id)?.status;

  return (
    <AppShell session={session} active="integrations" title="Central de Integrações" subtitle="Conectores nativos e webhooks (Módulo 8)" showReport={false}>
      <div className="card" style={{ marginBottom: 20 }}>
        <h2>Conectores</h2>
        <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {PROVIDERS.map((p) => {
            const connected = statusOf(p.id) === "CONNECTED";
            return (
              <div key={p.id} className="card" style={{ padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <strong>{p.label}</strong>
                  {connected ? <span className="badge LOW">Conectado</span> : <span className="badge" style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted)" }}>—</span>}
                </div>
                {connected ? (
                  <form action={disconnectAction}>
                    <input type="hidden" name="provider" value={p.id} />
                    <button className="btn-ghost btn-sm" type="submit">Desconectar</button>
                  </form>
                ) : (
                  <form action={connectAction} className="form-row">
                    <input type="hidden" name="provider" value={p.id} />
                    {p.key && <input name="token" placeholder="API key" style={{ flex: 1, minWidth: 0 }} />}
                    <button className="btn btn-sm" type="submit">Conectar</button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Webhooks (n8n / Zapier / Make)</h2>
          <form action={createWebhookAction}>
            <input name="url" placeholder="https://seu-n8n/webhook/..." required style={{ width: "100%", marginBottom: 10 }} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
              {Object.entries(EVENTS).map(([v, l]) => (
                <label key={v} className="stat-label" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <input type="checkbox" name="events" value={v} defaultChecked={v === "CRITICAL_RISK_DETECTED"} /> {l}
                </label>
              ))}
            </div>
            <button className="btn btn-sm" type="submit">Criar webhook</button>
          </form>
        </div>
        <div className="card">
          <h2>Endpoints ativos ({webhooks.length})</h2>
          {webhooks.length === 0 ? (
            <p className="stat-label">Nenhum webhook cadastrado.</p>
          ) : (
            <ul className="insights">
              {webhooks.map((w) => (
                <li key={w.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ minWidth: 0 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>{w.url}</div>
                    <span className="stat-label">{w.events.length} evento(s) · {w._count.deliveries} entrega(s)</span>
                  </span>
                  <form action={deleteWebhookAction}>
                    <input type="hidden" name="id" value={w.id} />
                    <button className="btn-ghost btn-sm" type="submit">Remover</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
