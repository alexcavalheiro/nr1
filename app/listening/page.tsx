import Link from "next/link";
import { ensureDb } from "@/src/db";
import { listManifestations } from "@/src/index";
import { canManage, requireSession } from "../lib/auth";
import { AppShell } from "../components/AppShell";
import { createManifestationAction } from "./actions";

export const dynamic = "force-dynamic";

export const MANIF_TYPES: Record<string, string> = {
  COMPLAINT: "Denúncia", SUGGESTION: "Sugestão", HELP_REQUEST: "Pedido de ajuda", RECOGNITION: "Reconhecimento",
};
export const MANIF_STATUS: Record<string, string> = {
  OPEN: "Aberta", IN_REVIEW: "Em análise", RESOLVED: "Resolvida", ARCHIVED: "Arquivada",
};

export default async function ListeningPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  await ensureDb();
  const session = await requireSession();
  const { sent } = await searchParams;
  const manage = canManage(session.role);
  const manifestations = manage ? await listManifestations(session.organizationId) : [];

  return (
    <AppShell session={session} active="listening" title="Escuta ativa" subtitle="Canal de manifestações e denúncias">
        <h2 className="section-title" style={{ marginTop: 0 }}>Registrar e tratar manifestações</h2>
        {sent && <div className="card" style={{ borderColor: "var(--low)", marginBottom: 16 }}>✓ Manifestação registrada. Obrigado por se manifestar.</div>}

        {/* Canal de envio — disponível a todos */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2>Registrar manifestação</h2>
          <form action={createManifestationAction}>
            <div className="form-row" style={{ marginBottom: 10 }}>
              <select name="type" required>
                {Object.entries(MANIF_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input name="subject" placeholder="Assunto (opcional)" style={{ flex: 1 }} />
              <label className="stat-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" name="anonymous" /> Enviar anonimamente
              </label>
            </div>
            <textarea name="body" rows={3} placeholder="Descreva sua manifestação…" required style={{ width: "100%", marginBottom: 10 }} />
            <button className="btn" style={{ width: "auto" }} type="submit">Enviar</button>
          </form>
          <p className="hint">Manifestações anônimas não vinculam sua identidade.</p>
        </div>

        {/* Painel de tratativa — apenas gestores */}
        {manage && (
          <div className="card">
            <h2>Manifestações recebidas ({manifestations.length})</h2>
            {manifestations.length === 0 ? (
              <p className="stat-label">Nenhuma manifestação.</p>
            ) : (
              <table>
                <thead>
                  <tr><th>Tipo</th><th>Assunto</th><th>Autor</th><th>Status</th><th>Responsável</th><th>Riscos</th></tr>
                </thead>
                <tbody>
                  {manifestations.map((m) => (
                    <tr key={m.id}>
                      <td><Link href={`/listening/${m.id}`}>{MANIF_TYPES[m.type] ?? m.type}</Link></td>
                      <td className="muted">{m.subject ?? "—"}</td>
                      <td className="muted">{m.anonymous ? "Anônimo" : m.author?.name ?? "—"}</td>
                      <td>{MANIF_STATUS[m.status] ?? m.status}</td>
                      <td className="muted">{m.handler?.name ?? "—"}</td>
                      <td>{m._count.riskSources}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
    </AppShell>
  );
}
