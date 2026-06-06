import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureDb } from "@/src/db";
import { employeeFormOptions, listEmployees } from "@/src/index";
import { canManage, requireSession } from "../lib/auth";
import { AppShell } from "../components/AppShell";
import { createEmployeeAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ColaboradoresPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; deleted?: string; error?: string }>;
}) {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) redirect("/dashboard");
  const { ok, deleted, error } = await searchParams;
  const [employees, options] = await Promise.all([
    listEmployees(session.organizationId),
    employeeFormOptions(session.organizationId),
  ]);

  return (
    <AppShell session={session} active="colaboradores" title="Colaboradores" subtitle="Cadastro da força de trabalho — visualizar, editar e excluir" showReport={false}>
      {ok && <p className="success" style={{ marginBottom: 16 }}>Colaborador cadastrado com sucesso.</p>}
      {deleted && <p className="success" style={{ marginBottom: 16 }}>Colaborador excluído.</p>}
      {error && <p className="error" style={{ marginBottom: 16 }}>{error}</p>}

      <div className="card" style={{ marginBottom: 20 }}>
        <details>
          <summary className="btn btn-sm" style={{ display: "inline-block", cursor: "pointer", width: "auto" }}>+ Novo colaborador</summary>
          <form action={createEmployeeAction} style={{ marginTop: 14 }}>
            <div className="form-row" style={{ marginBottom: 8 }}>
              <input name="name" placeholder="Nome completo *" required style={{ flex: 2 }} />
              <input name="cpf" placeholder="CPF" style={{ flex: 1 }} />
              <input name="jobTitle" placeholder="Cargo" style={{ flex: 1 }} />
            </div>
            <div className="form-row" style={{ marginBottom: 8 }}>
              <select name="companyId" defaultValue="" style={{ flex: 1 }}>
                <option value="">— Empresa —</option>
                {options.companies.map((c) => <option key={c.id} value={c.id}>{c.razaoSocial}</option>)}
              </select>
              <select name="departmentId" defaultValue="" style={{ flex: 1 }}>
                <option value="">— Setor —</option>
                {options.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select name="userId" defaultValue="" style={{ flex: 1 }}>
                <option value="">— Sem login —</option>
                {options.users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
              </select>
            </div>
            <div className="form-row" style={{ marginBottom: 8 }}>
              <input name="email" type="email" placeholder="E-mail" style={{ flex: 2 }} />
              <input name="phone" placeholder="Telefone" style={{ flex: 1 }} />
              <input name="admissionDate" type="date" title="Admissão" style={{ flex: 1 }} />
              <input name="status" placeholder="Status (ATIVO)" style={{ flex: 1 }} />
            </div>
            <button className="btn" type="submit" style={{ marginTop: 6 }}>Cadastrar colaborador</button>
          </form>
        </details>
      </div>

      <div className="card">
        <h2 className="section-title" style={{ marginTop: 0 }}>Colaboradores cadastrados ({employees.length})</h2>
        {employees.length === 0 ? (
          <p className="stat-label">Nenhum colaborador cadastrado ainda. Use “Novo colaborador” acima.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Nome</th><th>Cargo</th><th>Empresa</th><th>Setor</th><th>Login</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td><Link href={`/colaboradores/${e.id}`}>{e.name}</Link>{e.cpf ? <div className="hint">{e.cpf}</div> : null}</td>
                  <td>{e.jobTitle ?? "—"}</td>
                  <td>{e.company?.nomeFantasia ?? e.company?.razaoSocial ?? "—"}</td>
                  <td>{e.department?.name ?? "—"}</td>
                  <td>{e.user ? <span className="badge LOW">{e.user.email}</span> : <span className="hint">sem login</span>}</td>
                  <td>{e.status ?? "—"}</td>
                  <td><Link href={`/colaboradores/${e.id}`} className="btn-ghost btn-sm">Editar</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
