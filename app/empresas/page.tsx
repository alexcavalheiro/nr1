import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureDb } from "@/src/db";
import { listCompanies } from "@/src/index";
import { canManage, requireSession } from "../lib/auth";
import { AppShell } from "../components/AppShell";
import { createCompanyAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function EmpresasPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; deleted?: string; error?: string }>;
}) {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) redirect("/dashboard");
  const { ok, deleted, error } = await searchParams;
  const companies = await listCompanies(session.organizationId);

  return (
    <AppShell session={session} active="empresas" title="Empresas" subtitle="Cadastro corporativo — visualizar, editar e excluir" showReport={false}>
      {ok && <p className="success" style={{ marginBottom: 16 }}>Empresa cadastrada com sucesso.</p>}
      {deleted && <p className="success" style={{ marginBottom: 16 }}>Empresa excluída.</p>}
      {error && <p className="error" style={{ marginBottom: 16 }}>{error}</p>}

      <div className="card" style={{ marginBottom: 20 }}>
        <details>
          <summary className="btn btn-sm" style={{ display: "inline-block", cursor: "pointer", width: "auto" }}>+ Nova empresa</summary>
          <form action={createCompanyAction} style={{ marginTop: 14 }}>
            <div className="form-row" style={{ marginBottom: 8 }}>
              <input name="razaoSocial" placeholder="Razão social *" required style={{ flex: 2 }} />
              <input name="nomeFantasia" placeholder="Nome fantasia" style={{ flex: 2 }} />
              <input name="cnpj" placeholder="CNPJ *" required style={{ flex: 1 }} />
            </div>
            <div className="form-row" style={{ marginBottom: 8 }}>
              <input name="cidade" placeholder="Cidade" style={{ flex: 2 }} />
              <input name="estado" placeholder="UF" style={{ flex: 1 }} maxLength={2} />
              <input name="cep" placeholder="CEP" style={{ flex: 1 }} />
              <input name="status" placeholder="Status (ex.: ATIVA)" style={{ flex: 1 }} />
            </div>
            <div className="form-row" style={{ marginBottom: 8 }}>
              <input name="telefone" placeholder="Telefone" style={{ flex: 1 }} />
              <input name="email" type="email" placeholder="E-mail" style={{ flex: 2 }} />
            </div>
            <button className="btn" type="submit" style={{ marginTop: 6 }}>Cadastrar empresa</button>
          </form>
        </details>
      </div>

      <div className="card">
        <h2 className="section-title" style={{ marginTop: 0 }}>Empresas cadastradas ({companies.length})</h2>
        {companies.length === 0 ? (
          <p className="stat-label">Nenhuma empresa cadastrada ainda. Use “Nova empresa” acima ou a importação de planilha.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Razão social</th><th>CNPJ</th><th>Cidade/UF</th><th>Status</th><th>Vínculos</th><th></th></tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}>
                  <td><Link href={`/empresas/${c.id}`}>{c.razaoSocial}</Link>{c.nomeFantasia ? <div className="hint">{c.nomeFantasia}</div> : null}</td>
                  <td>{c.cnpj}</td>
                  <td>{c.cidade ? `${c.cidade}${c.estado ? "/" + c.estado : ""}` : "—"}</td>
                  <td>{c.status ?? "—"}</td>
                  <td className="hint">{c._count.employees} colab. · {c._count.partners} sócios · {c._count.contracts} contr.</td>
                  <td><Link href={`/empresas/${c.id}`} className="btn-ghost btn-sm">Editar</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
