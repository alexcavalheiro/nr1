import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureDb } from "@/src/db";
import { accessDashboard, listMembers } from "@/src/index";
import { canManage, requireSession, ROLE_LABEL } from "../lib/auth";
import { AppShell } from "../components/AppShell";
import { changeRoleAction, createMemberAction, resetPasswordAction, toggleActiveAction } from "./actions";

export const dynamic = "force-dynamic";

const ROLES = ["COMPANY_ADMIN", "UNIT_MANAGER", "CONSULTANT", "HR", "LEADER", "EMPLOYEE", "AUDITOR", "SESMT", "OCCUPATIONAL_DOCTOR", "CIPA_MEMBER"];

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; error?: string }>;
}) {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) redirect("/dashboard");
  const [members, dash] = await Promise.all([
    listMembers(session.organizationId),
    accessDashboard(session.organizationId),
  ]);
  const { reset, error } = await searchParams;

  return (
    <AppShell session={session} active="users" title="Usuários e perfis" subtitle="Gestão de membros e papéis de acesso" showReport={false}>
      {reset && <p className="success" style={{ marginBottom: 16 }}>Senha redefinida com sucesso.</p>}
      {error && <p className="error" style={{ marginBottom: 16 }}>{error}</p>}

      <div className="card" style={{ marginBottom: 20 }}>
        <h2>Dashboard de usuários e acessos</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginTop: 8 }}>
          <div><div className="stat-label">Ativos</div><strong style={{ fontSize: 20 }}>{dash.active}</strong></div>
          <div><div className="stat-label">Inativos</div><strong style={{ fontSize: 20 }}>{dash.inactive}</strong></div>
          <div><div className="stat-label">Sem acesso há 30d+</div><strong style={{ fontSize: 20 }}>{dash.noAccess30}</strong></div>
          <div><div className="stat-label">Logins inválidos (30d)</div><strong style={{ fontSize: 20 }}>{dash.failed30}</strong></div>
          <div><div className="stat-label">Alterações de perfil (30d)</div><strong style={{ fontSize: 20 }}>{dash.permChanges30}</strong></div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
          {Object.entries(dash.byRole).map(([role, n]) => (
            <span key={role} className="badge AI">{ROLE_LABEL[role] ?? role}: {n}</span>
          ))}
        </div>
        {dash.recentLogins.length > 0 && (
          <p className="hint" style={{ marginTop: 10 }}>
            Últimos acessos: {dash.recentLogins.map((l) => `${l.name} (${new Date(l.at).toLocaleString("pt-BR")})`).join(" · ")}
          </p>
        )}
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        <h2>Adicionar membro</h2>
        <form action={createMemberAction} className="form-row">
          <input name="name" placeholder="Nome" required style={{ flex: 1 }} />
          <input name="email" type="email" placeholder="E-mail" required style={{ flex: 1 }} />
          <input name="jobTitle" placeholder="Cargo (opcional)" style={{ flex: 1 }} />
          <select name="role" required defaultValue="EMPLOYEE">
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}
          </select>
          <input name="password" placeholder="Senha inicial" defaultValue="nr1@2026" style={{ width: 130 }} />
          <button className="btn" style={{ width: "auto" }} type="submit">Convidar</button>
        </form>
      </div>

      <div className="card">
        <h2>Membros ({members.length})</h2>
        <table>
          <thead>
            <tr><th>Nome</th><th>E-mail</th><th>Cargo</th><th>Perfil</th><th>Senha</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} style={{ opacity: m.active ? 1 : 0.5 }}>
                <td><strong>{m.user.name}</strong>{m.userId === session.userId && <span className="stat-label"> · você</span>}</td>
                <td className="stat-label">{m.user.email}</td>
                <td className="stat-label">{m.jobTitle ?? "—"}</td>
                <td>
                  <form action={changeRoleAction} className="form-row">
                    <input type="hidden" name="id" value={m.id} />
                    <select key={m.role} name="role" defaultValue={m.role} className="btn-sm" style={{ padding: "5px 8px" }}>
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}
                    </select>
                    <button className="btn-ghost btn-sm" type="submit">Salvar</button>
                  </form>
                </td>
                <td>
                  <form action={resetPasswordAction} className="form-row">
                    <input type="hidden" name="id" value={m.id} />
                    <input name="password" type="text" placeholder="Nova senha" minLength={6} required className="btn-sm" style={{ width: 120, padding: "5px 8px" }} />
                    <button className="btn-ghost btn-sm" type="submit">Redefinir</button>
                  </form>
                </td>
                <td>{m.active ? <span className="badge LOW">Ativo</span> : <span className="badge CRITICAL">Inativo</span>}</td>
                <td>
                  <div className="form-row">
                    <Link href={`/users/${m.id}`} className="btn-ghost btn-sm">Editar</Link>
                    {m.userId !== session.userId && (
                      <form action={toggleActiveAction}>
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="active" value={(!m.active).toString()} />
                        <button className="btn-ghost btn-sm" type="submit">{m.active ? "Desativar" : "Ativar"}</button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
