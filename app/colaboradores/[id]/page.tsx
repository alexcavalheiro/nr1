import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ensureDb } from "@/src/db";
import { employeeFormOptions, getEmployee } from "@/src/index";
import { canManage, requireSession } from "../../lib/auth";
import { AppShell } from "../../components/AppShell";
import { deleteEmployeeAction, updateEmployeeAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ColaboradorEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) redirect("/dashboard");
  const { id } = await params;
  const { ok, error } = await searchParams;
  const [e, options] = await Promise.all([
    getEmployee(session.organizationId, id),
    employeeFormOptions(session.organizationId),
  ]);
  if (!e) notFound();

  return (
    <AppShell session={session} active="colaboradores" title={`Editar ${e.name}`} subtitle="Dados do colaborador" showReport={false}>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <Link href="/colaboradores" className="btn-ghost btn-sm">← Voltar para Colaboradores</Link>
        <Link href={`/colaboradores/${e.id}/dossie`} className="btn btn-sm" style={{ width: "auto" }}>📄 Gerar dossiê (PDF)</Link>
      </div>
      {ok && <p className="success" style={{ marginBottom: 16 }}>Colaborador atualizado com sucesso.</p>}
      {error && <p className="error" style={{ marginBottom: 16 }}>{error}</p>}

      <div className="card" style={{ maxWidth: 720, marginBottom: 20 }}>
        <form action={updateEmployeeAction}>
          <input type="hidden" name="id" value={e.id} />
          <div className="form-row" style={{ marginBottom: 8 }}>
            <div style={{ flex: 2 }}><label>Nome completo *</label><input name="name" defaultValue={e.name} required /></div>
            <div style={{ flex: 1 }}><label>CPF</label><input name="cpf" defaultValue={e.cpf ?? ""} /></div>
            <div style={{ flex: 1 }}><label>Cargo</label><input name="jobTitle" defaultValue={e.jobTitle ?? ""} /></div>
          </div>
          <div className="form-row" style={{ marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <label>Empresa</label>
              <select name="companyId" defaultValue={e.companyId ?? ""}>
                <option value="">— Empresa —</option>
                {options.companies.map((c) => <option key={c.id} value={c.id}>{c.razaoSocial}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>Setor</label>
              <select name="departmentId" defaultValue={e.departmentId ?? ""}>
                <option value="">— Setor —</option>
                {options.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>Usuário (login)</label>
              <select name="userId" defaultValue={e.userId ?? ""}>
                <option value="">— Sem login —</option>
                {options.users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
              </select>
            </div>
          </div>
          <div className="form-row" style={{ marginBottom: 8 }}>
            <div style={{ flex: 2 }}><label>E-mail</label><input name="email" type="email" defaultValue={e.email ?? ""} /></div>
            <div style={{ flex: 1 }}><label>Telefone</label><input name="phone" defaultValue={e.phone ?? ""} /></div>
            <div style={{ flex: 1 }}><label>Admissão</label><input name="admissionDate" type="date" defaultValue={e.admissionDate ? e.admissionDate.toISOString().slice(0, 10) : ""} /></div>
            <div style={{ flex: 1 }}><label>Status</label><input name="status" defaultValue={e.status ?? ""} /></div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>Observações</label>
            <input name="observacoes" defaultValue={e.observacoes ?? ""} />
          </div>
          <button className="btn" type="submit" style={{ marginTop: 12 }}>Salvar alterações</button>
        </form>
      </div>

      <div className="card" style={{ maxWidth: 720 }}>
        <h2>Excluir colaborador</h2>
        <p className="stat-label" style={{ marginBottom: 10 }}>Remove o cadastro do colaborador. Não afeta o usuário de login vinculado (se houver). Ação irreversível.</p>
        <form action={deleteEmployeeAction}>
          <input type="hidden" name="id" value={e.id} />
          <button className="btn-ghost btn-sm" type="submit">Excluir colaborador</button>
        </form>
      </div>
    </AppShell>
  );
}
