"use client";

import { useActionState } from "react";
import { importAction, type ImportState } from "./actions";

const initial: ImportState = {};

export function ImportForm() {
  const [state, formAction, pending] = useActionState(importAction, initial);
  const { report, result } = state;

  return (
    <div>
      <form action={formAction}>
        <div className="form-row">
          <input name="file" type="file" accept=".xlsx,.xls" required style={{ flex: 1 }} />
          <button className="btn-ghost" name="mode" value="validate" type="submit" disabled={pending} style={{ width: "auto" }}>
            {pending ? "Processando…" : "Validar"}
          </button>
          <button className="btn" name="mode" value="commit" type="submit" disabled={pending} style={{ width: "auto" }}>
            Importar (gravar)
          </button>
        </div>
        <p className="hint" style={{ marginTop: 6 }}>Recomendado: valide primeiro; depois clique em Importar para gravar (cria/atualiza por CNPJ/CPF).</p>
      </form>

      {state.error && <p className="error" style={{ marginTop: 12 }}>{state.error}</p>}

      {result && (
        <p className="success" style={{ marginTop: 12 }}>
          ✓ Importação concluída — {result.created} criado(s), {result.updated} atualizado(s).
        </p>
      )}

      {report && (
        <div style={{ marginTop: 16 }}>
          {!result && (
            <p className={report.ok ? "success" : "error"}>
              {report.ok
                ? `✓ Planilha válida — ${report.totalRows} registro(s) prontos para importar.`
                : `${report.totalRows} registro(s) lidos · ${report.totalErrors} inconsistência(s).`}
            </p>
          )}

          <table style={{ marginBottom: 16 }}>
            <thead><tr><th>Aba</th><th>Encontrada</th><th>Registros</th><th>Com erro</th>{result && <th>Criados</th>}{result && <th>Atualizados</th>}<th>Colunas faltando</th></tr></thead>
            <tbody>
              {report.tabs.map((t) => (
                <tr key={t.name}>
                  <td><strong>{t.name}</strong></td>
                  <td>{t.found ? <span className="badge LOW">Sim</span> : <span className="badge CRITICAL">Não</span>}</td>
                  <td>{t.rows}</td>
                  <td>{t.errorRows > 0 ? <span className="badge HIGH">{t.errorRows}</span> : "0"}</td>
                  {result && <td>{result.perTab[t.name]?.created ?? 0}</td>}
                  {result && <td>{result.perTab[t.name]?.updated ?? 0}</td>}
                  <td className="stat-label">{t.missingColumns.join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {report.issues.length > 0 && (
            <>
              <h3 className="section-title">Inconsistências ({report.issues.length})</h3>
              <table>
                <thead><tr><th>Aba</th><th>Linha</th><th>Campo</th><th>Problema</th></tr></thead>
                <tbody>
                  {report.issues.slice(0, 200).map((i, idx) => (
                    <tr key={idx}>
                      <td>{i.tab}</td>
                      <td>{i.row || "—"}</td>
                      <td>{i.column}</td>
                      <td className="stat-label">{i.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {report.issues.length > 200 && <p className="hint">Mostrando as 200 primeiras de {report.issues.length}.</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
