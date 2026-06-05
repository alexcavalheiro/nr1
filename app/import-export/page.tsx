import { redirect } from "next/navigation";
import { ensureDb } from "@/src/db";
import { canManage, requireSession } from "../lib/auth";
import { AppShell } from "../components/AppShell";
import { TAB_SPECS } from "@/src/services/import-data";
import { ImportForm } from "./ImportForm";

export const dynamic = "force-dynamic";

export default async function ImportExportPage() {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) redirect("/dashboard");

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
        <p className="hint" style={{ marginTop: 12 }}>
          A gravação definitiva (criar/atualizar empresas, sócios, contratos etc., com dedupe por CNPJ/CPF e histórico de
          importações) é a próxima fase e depende dos novos modelos de dados no banco.
        </p>
      </div>
    </AppShell>
  );
}
