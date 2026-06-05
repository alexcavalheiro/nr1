import { redirect } from "next/navigation";
import { ensureDb } from "@/src/db";
import { auditStats, listAuditLogs } from "@/src/index";
import { canViewDocs, requireSession } from "../lib/auth";
import { AppShell } from "../components/AppShell";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  "auth.login": "Login",
  "auth.login_failed": "Tentativa de login inválida",
  "user.created": "Usuário criado",
  "user.updated": "Usuário alterado",
  "user.role_changed": "Perfil alterado",
  "user.activated": "Usuário ativado",
  "user.deactivated": "Usuário desativado",
  "user.password_reset": "Senha redefinida",
  "account.password_changed": "Senha alterada (própria)",
  "account.profile_updated": "Perfil alterado (próprio)",
  "risk.deleted": "Risco excluído",
  "survey.deleted": "Pesquisa excluída",
  "feed.deleted": "Publicação excluída",
  "document.deleted": "Documento excluído",
  "document.report_generated": "Relatório NR-1 gerado",
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; entityType?: string }>;
}) {
  await ensureDb();
  const session = await requireSession();
  if (!canViewDocs(session.role)) redirect("/dashboard");
  const { action, entityType } = await searchParams;

  const [stats, logs] = await Promise.all([
    auditStats(session.organizationId),
    listAuditLogs(session.organizationId, { action, entityType }),
  ]);

  return (
    <AppShell session={session} active="audit" title="Auditoria e logs" subtitle="Trilha de ações dos usuários (acessos, alterações e exclusões)" showReport={false}>
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <h2>Resumo</h2>
          <p className="stat-label" style={{ margin: "6px 0" }}><strong>{stats.total}</strong> registros no total · <strong>{stats.last30}</strong> nos últimos 30 dias.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {stats.byAction.map((a) => (
              <a key={a.action} href={`/audit?action=${encodeURIComponent(a.action)}`} className="badge AI" style={{ textDecoration: "none" }}>
                {ACTION_LABEL[a.action] ?? a.action} ({a.count})
              </a>
            ))}
          </div>
        </div>
        <div className="card">
          <h2>Por tipo de registro</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {stats.byEntity.map((e) => (
              <a key={e.entityType} href={`/audit?entityType=${encodeURIComponent(e.entityType)}`} className="badge" style={{ textDecoration: "none" }}>
                {e.entityType} ({e.count})
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Eventos ({logs.length})</h2>
          {(action || entityType) && <a href="/audit" className="btn-ghost btn-sm">Limpar filtro</a>}
        </div>
        {logs.length === 0 ? (
          <p className="stat-label">Nenhum registro de auditoria.</p>
        ) : (
          <table>
            <thead><tr><th>Data/hora</th><th>Usuário</th><th>Ação</th><th>Registro</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="muted">{new Date(l.createdAt).toLocaleString("pt-BR")}</td>
                  <td>{l.actor?.name ?? <span className="stat-label">Sistema</span>}</td>
                  <td>{ACTION_LABEL[l.action] ?? l.action}</td>
                  <td className="stat-label">{l.entityType}{l.entityId ? ` · ${l.entityId.slice(0, 8)}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
