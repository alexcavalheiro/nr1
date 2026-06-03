import { redirect } from "next/navigation";
import { ensureDb } from "@/src/db";
import { listMembers } from "@/src/index";
import { canManage, requireSession, ROLE_LABEL } from "../lib/auth";
import { AppShell } from "../components/AppShell";
import { changeRoleAction, createMemberAction, toggleActiveAction } from "./actions";

export const dynamic = "force-dynamic";

const ROLES = ["COMPANY_ADMIN", "CONSULTANT", "HR", "LEADER", "EMPLOYEE", "AUDITOR"];

export default async function UsersPage() {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) redirect("/dashboard");
  const members = await listMembers(session.organizationId);

  return (
    <AppShell session={session} active="users" title="Usuários e perfis" subtitle="Gestão de membros e papéis de acesso" showReport={false}>
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
            <tr><th>Nome</th><th>E-mail</th><th>Cargo</th><th>Perfil</th><th>Status</th><th></th></tr>
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
                    <select name="role" defaultValue={m.role} className="btn-sm" style={{ padding: "5px 8px" }}>
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}
                    </select>
                    <button className="btn-ghost btn-sm" type="submit">Salvar</button>
                  </form>
                </td>
                <td>{m.active ? <span className="badge LOW">Ativo</span> : <span className="badge CRITICAL">Inativo</span>}</td>
                <td>
                  {m.userId !== session.userId && (
                    <form action={toggleActiveAction}>
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="active" value={(!m.active).toString()} />
                      <button className="btn-ghost btn-sm" type="submit">{m.active ? "Desativar" : "Ativar"}</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
