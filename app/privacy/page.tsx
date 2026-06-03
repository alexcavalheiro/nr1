import { ensureDb } from "@/src/db";
import { getActivePolicies, getMyConsents, listMyDataRequests, listOrgDataRequests } from "@/src/index";
import { canManage, requireSession } from "../lib/auth";
import { AppShell } from "../components/AppShell";
import { createDataRequestAction, grantConsentAction, revokeConsentAction, updateRequestStatusAction } from "./actions";

export const dynamic = "force-dynamic";

const REQ_TYPES: Record<string, string> = {
  ACCESS: "Acesso aos dados", DELETION: "Exclusão / anonimização", RECTIFICATION: "Correção",
  PORTABILITY: "Portabilidade", OBJECTION: "Oposição ao tratamento", INFO: "Informação de uso",
};
const REQ_STATUS: Record<string, string> = { RECEIVED: "Recebida", IN_PROGRESS: "Em andamento", COMPLETED: "Concluída", REJECTED: "Rejeitada" };
const STATUS_BADGE: Record<string, string> = { RECEIVED: "HIGH", IN_PROGRESS: "MODERATE", COMPLETED: "LOW", REJECTED: "CRITICAL" };

export default async function PrivacyPage() {
  await ensureDb();
  const session = await requireSession();
  const manage = canManage(session.role);
  const [policies, myConsents, myRequests, orgRequests] = await Promise.all([
    getActivePolicies(),
    getMyConsents(session.userId),
    listMyDataRequests(session.userId),
    manage ? listOrgDataRequests(session.organizationId) : Promise.resolve([]),
  ]);

  const latestFor = (policyId: string) => myConsents.find((c) => c.policyId === policyId);

  return (
    <AppShell session={session} active="privacy" title="Privacidade e LGPD" subtitle="Consentimento e direitos do titular dos dados" showReport={false}>
      <div className="grid-2">
        <div className="card">
          <h2>Meus consentimentos</h2>
          {policies.length === 0 ? <p className="stat-label">Nenhuma política ativa.</p> : policies.map((p) => {
            const c = latestFor(p.id);
            const granted = c?.status === "GRANTED";
            return (
              <div key={p.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>{p.title}</strong>
                  {granted ? <span className="badge LOW">Concedido</span> : <span className="badge CRITICAL">Não concedido</span>}
                </div>
                <p className="stat-label" style={{ margin: "4px 0 8px" }}>{p.body}</p>
                {granted ? (
                  <form action={revokeConsentAction}><input type="hidden" name="consentId" value={c!.id} /><button className="btn-ghost btn-sm" type="submit">Revogar</button></form>
                ) : (
                  <form action={grantConsentAction}>
                    <input type="hidden" name="policyId" value={p.id} />
                    <input type="hidden" name="purpose" value={p.purpose} />
                    <button className="btn btn-sm" type="submit">Dar consentimento</button>
                  </form>
                )}
              </div>
            );
          })}
        </div>

        <div className="card">
          <h2>Solicitar direito do titular</h2>
          <form action={createDataRequestAction}>
            <select name="type" required style={{ width: "100%", marginBottom: 10 }}>
              {Object.entries(REQ_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <textarea name="details" rows={2} placeholder="Detalhes (opcional)" style={{ width: "100%", marginBottom: 10 }} />
            <button className="btn btn-sm" type="submit">Abrir solicitação</button>
          </form>
          {myRequests.length > 0 && (
            <ul className="insights" style={{ marginTop: 14 }}>
              {myRequests.map((r) => (
                <li key={r.id}><span className={`badge ${STATUS_BADGE[r.status]}`}>{REQ_STATUS[r.status]}</span> {REQ_TYPES[r.type] ?? r.type}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {manage && (
        <>
          <h3 className="section-title">Solicitações recebidas ({orgRequests.length})</h3>
          <div className="card">
            {orgRequests.length === 0 ? <p className="stat-label">Nenhuma solicitação.</p> : (
              <table>
                <thead><tr><th>Titular</th><th>Tipo</th><th>Aberta em</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {orgRequests.map((r) => (
                    <tr key={r.id}>
                      <td>{r.user.name}<div className="stat-label">{r.user.email}</div></td>
                      <td className="stat-label">{REQ_TYPES[r.type] ?? r.type}</td>
                      <td className="stat-label">{new Date(r.requestedAt).toLocaleDateString("pt-BR")}</td>
                      <td><span className={`badge ${STATUS_BADGE[r.status]}`}>{REQ_STATUS[r.status]}</span></td>
                      <td>
                        <form action={updateRequestStatusAction} className="form-row">
                          <input type="hidden" name="id" value={r.id} />
                          <select name="status" defaultValue={r.status} className="btn-sm" style={{ padding: "5px 8px" }}>
                            {Object.entries(REQ_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                          <button className="btn-ghost btn-sm" type="submit">Salvar</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}
