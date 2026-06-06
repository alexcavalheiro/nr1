import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ensureDb } from "@/src/db";
import { getCompany } from "@/src/index";
import { canManage, requireSession } from "../../lib/auth";
import { AppShell } from "../../components/AppShell";
import { deleteCompanyAction, updateCompanyAction } from "../actions";

export const dynamic = "force-dynamic";

const F = ({ label, name, value, ...rest }: { label: string; name: string; value?: string | null } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "name">) => (
  <div style={{ flex: 1 }}>
    <label>{label}</label>
    <input name={name} defaultValue={value ?? ""} {...rest} />
  </div>
);

export default async function EmpresaEditPage({
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
  const c = await getCompany(session.organizationId, id);
  if (!c) notFound();

  return (
    <AppShell session={session} active="empresas" title={`Editar ${c.razaoSocial}`} subtitle="Dados cadastrais da empresa" showReport={false}>
      <p style={{ marginBottom: 16 }}><Link href="/empresas" className="btn-ghost btn-sm">← Voltar para Empresas</Link></p>
      {ok && <p className="success" style={{ marginBottom: 16 }}>Empresa atualizada com sucesso.</p>}
      {error && <p className="error" style={{ marginBottom: 16 }}>{error}</p>}

      <div className="card" style={{ maxWidth: 720, marginBottom: 20 }}>
        <form action={updateCompanyAction}>
          <input type="hidden" name="id" value={c.id} />
          <div className="form-row" style={{ marginBottom: 8 }}>
            <F label="Razão social *" name="razaoSocial" value={c.razaoSocial} required />
            <F label="Nome fantasia" name="nomeFantasia" value={c.nomeFantasia} />
          </div>
          <div className="form-row" style={{ marginBottom: 8 }}>
            <F label="CNPJ *" name="cnpj" value={c.cnpj} required />
            <F label="Inscrição estadual" name="inscricaoEstadual" value={c.inscricaoEstadual} />
            <F label="Inscrição municipal" name="inscricaoMunicipal" value={c.inscricaoMunicipal} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>Endereço</label>
            <input name="endereco" defaultValue={c.endereco ?? ""} />
          </div>
          <div className="form-row" style={{ marginBottom: 8 }}>
            <F label="Cidade" name="cidade" value={c.cidade} />
            <F label="UF" name="estado" value={c.estado} maxLength={2} />
            <F label="CEP" name="cep" value={c.cep} />
            <F label="Status" name="status" value={c.status} />
          </div>
          <div className="form-row" style={{ marginBottom: 8 }}>
            <F label="Telefone" name="telefone" value={c.telefone} />
            <F label="E-mail" name="email" value={c.email} type="email" />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>Observações</label>
            <input name="observacoes" defaultValue={c.observacoes ?? ""} />
          </div>
          <button className="btn" type="submit" style={{ marginTop: 12 }}>Salvar alterações</button>
        </form>
      </div>

      <div className="card" style={{ maxWidth: 720 }}>
        <h2>Excluir empresa</h2>
        <p className="stat-label" style={{ marginBottom: 10 }}>Remove a empresa e seus vínculos (sócios, contratos, fornecedores, obrigações e pendências). Colaboradores ficam sem empresa. Ação irreversível.</p>
        <form action={deleteCompanyAction}>
          <input type="hidden" name="id" value={c.id} />
          <button className="btn-ghost btn-sm" type="submit">Excluir empresa</button>
        </form>
      </div>
    </AppShell>
  );
}
