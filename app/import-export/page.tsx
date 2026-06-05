import { redirect } from "next/navigation";
import { ensureDb } from "@/src/db";
import { canManage, requireSession } from "../lib/auth";
import { AppShell } from "../components/AppShell";
import { TAB_SPECS } from "@/src/services/import-data";
import { corporateCounts, listImportBatches } from "@/src/services/import-commit";
import { ImportForm } from "./ImportForm";

export const dynamic = "force-dynamic";

export default async function ImportExportPage() {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) redirect("/dashboard");
  const [counts, batches] = await Promise.all([
    corporateCounts(session.organizationId),
    listImportBatches(session.organizationId),
  ]);

  return (
    <AppShell session={session} active="import-export" title="Importação e Exportação de Dados" subtitle="Planilha padrão de empresas, sócios, contratos, fornecedores, obrigações e pendências" showReport={false}>
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <h2>1. Baixar modelo</h2>
          <p className="stat-label">Gera uma planilha Excel padrão com as abas e colunas corretas para preenchimento (campos obrigatórios marcados com *).</p>
          <a className="btn" style={{ width: "auto", textDecoration: "none", padding: "9px 14px", marginTop: 8, display: "inline-block" }} href="/import-export/template">
            Baixar modelo de importação (.xlsx)
          </a>
        </div>
        <div className="card">
          <h2>Abas do modelo</h2>
          <ul className="insights">
            {TAB_SPECS.map((t) => (
              <li key={t.name} className="stat-label"><strong>{t.name}</strong> · {t.columns.length} colunas</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card">
        <h2>2. Importar planilha (pré-validação)</h2>
        <p className="stat-label">
          Envie a planilha preenchida (.xlsx). O sistema lê todas as abas, confere as colunas obrigatórias e valida CNPJ, CPF,
          e-mail, datas e percentuais, exibindo um relatório de conferência antes de qualquer gravação.
        </p>
        <div style={{ marginTop: 12 }}>
          <ImportForm />
        </div>
      </div>

      <h3 className="section-title">Dados cadastrados</h3>
      <div className="card">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
          <div><div className="stat-label">Empresas</div><strong style={{ fontSize: 20 }}>{counts.companies}</strong></div>
          <div><div className="stat-label">Sócios</div><strong style={{ fontSize: 20 }}>{counts.partners}</strong></div>
          <div><div className="stat-label">Contratos</div><strong style={{ fontSize: 20 }}>{counts.contracts}</strong></div>
          <div><div className="stat-label">Fornecedores</div><strong style={{ fontSize: 20 }}>{counts.suppliers}</strong></div>
          <div><div className="stat-label">Obrigações</div><strong style={{ fontSize: 20 }}>{counts.obligations}</strong></div>
          <div><div className="stat-label">Pendências</div><strong style={{ fontSize: 20 }}>{counts.pendencies}</strong></div>
        </div>
      </div>

      <h3 className="section-title">Histórico de importações ({batches.length})</h3>
      <div className="card">
        {batches.length === 0 ? (
          <p className="stat-label">Nenhuma importação realizada ainda.</p>
        ) : (
          <table>
            <thead><tr><th>Data</th><th>Arquivo</th><th>Criados</th><th>Atualizados</th><th>Status</th></tr></thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <td className="muted">{new Date(b.createdAt).toLocaleString("pt-BR")}</td>
                  <td>{b.fileName ?? "—"}</td>
                  <td>{b.created}</td>
                  <td>{b.updated}</td>
                  <td><span className="badge LOW">{b.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
