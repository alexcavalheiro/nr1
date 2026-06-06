import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureDb } from "@/src/db";
import { listClients, platformStats } from "@/src/index";
import { requireSession } from "../lib/auth";
import { AppShell } from "../components/AppShell";
import { createClientAction, enterClientAction, toggleClientAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  await ensureDb();
  const session = await requireSession();
  if (session.role !== "SUPER_ADMIN") redirect("/dashboard");
  const { created, error } = await searchParams;
  const [clients, stats] = await Promise.all([listClients(), platformStats()]);

  const [createdName, createdEmail, createdPass] = created ? created.split("|") : [];

  return (
    <AppShell session={session} active="admin" title="Painel do Provedor" subtitle="Gestão dos clientes da plataforma" showReport={false}>
      {error && <p className="error" style={{ marginBottom: 16 }}>{error}</p>}
      {created && (
        <div className="card" style={{ marginBottom: 16, borderLeft: "4px solid var(--ok, #16a34a)" }}>
          <strong>Cliente “{createdName}” criado!</strong>
          <p className="stat-label" style={{ marginTop: 6 }}>
            Login do gestor — anote e repasse: <code>{createdEmail}</code> · senha provisória: <code>{createdPass}</code>
          </p>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
          <div><div className="stat-label">Clientes</div><strong style={{ fontSize: 22 }}>{stats.clients}</strong></div>
          <div><div className="stat-label">Ativos</div><strong style={{ fontSize: 22 }}>{stats.active}</strong></div>
          <div><div className="stat-label">Suspensos</div><strong style={{ fontSize: 22 }}>{stats.suspended}</strong></div>
          <div><div className="stat-label">Usuários (total)</div><strong style={{ fontSize: 22 }}>{stats.users}</strong></div>
          <div><div className="stat-label">Colaboradores (total)</div><strong style={{ fontSize: 22 }}>{stats.employees}</strong></div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <details>
          <summary className="btn btn-sm" style={{ display: "inline-block", cursor: "pointer", width: "auto" }}>+ Novo cliente</summary>
          <form action={createClientAction} style={{ marginTop: 14 }}>
            <p className="stat-label" style={{ marginBottom: 6 }}>Dados da empresa-cliente</p>
            <div className="form-row" style={{ marginBottom: 8 }}>
              <input name="name" placeholder="Nome do cliente *" required style={{ flex: 2 }} />
              <input name="cnpj" placeholder="CNPJ" style={{ flex: 1 }} />
              <input name="industry" placeholder="Segmento" style={{ flex: 1 }} />
            </div>
            <p className="stat-label" style={{ margin: "10px 0 6px" }}>Primeiro gestor (login de acesso)</p>
            <div className="form-row" style={{ marginBottom: 8 }}>
              <input name="adminName" placeholder="Nome do gestor *" required style={{ flex: 1 }} />
              <input name="adminEmail" type="email" placeholder="E-mail do gestor *" required style={{ flex: 1 }} />
              <input name="adminPassword" placeholder="Senha provisória" defaultValue="nr1@2026" style={{ flex: 1 }} />
            </div>
            <button className="btn" type="submit" style={{ marginTop: 6 }}>Criar cliente</button>
          </form>
        </details>
      </div>

      <div className="card">
        <h2 className="section-title" style={{ marginTop: 0 }}>Clientes ({clients.length})</h2>
        {clients.length === 0 ? (
          <p className="stat-label">Nenhum cliente ainda. Crie o primeiro acima.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Cliente</th><th>Plano</th><th>Usuários</th><th>Colab.</th><th>Empresas</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} style={{ opacity: c.active ? 1 : 0.55 }}>
                  <td><Link href={`/admin/${c.id}`}>{c.name}</Link>{c.cnpj ? <div className="hint">{c.cnpj}</div> : null}</td>
                  <td><span className="badge">{c.plan ?? "—"}</span></td>
                  <td>{c._count.memberships}{c.maxUsers != null ? <span className="hint">/{c.maxUsers}</span> : null}</td>
                  <td>{c._count.employees}{c.maxEmployees != null ? <span className="hint">/{c.maxEmployees}</span> : null}</td>
                  <td>{c._count.companies}</td>
                  <td>{c.active ? <span className="badge LOW">Ativo</span> : <span className="badge CRITICAL">Suspenso</span>}</td>
                  <td>
                    <div className="form-row">
                      <form action={enterClientAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="btn-ghost btn-sm" type="submit">Entrar</button>
                      </form>
                      <form action={toggleClientAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="active" value={(!c.active).toString()} />
                        <button className="btn-ghost btn-sm" type="submit">{c.active ? "Suspender" : "Reativar"}</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
