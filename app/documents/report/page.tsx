import { redirect } from "next/navigation";
import { ensureDb } from "@/src/db";
import { buildNr1Report } from "@/src/index";
import { canViewDocs, requireSession } from "../../lib/auth";
import { PrintButton } from "../../components/PrintButton";

export const dynamic = "force-dynamic";

export default async function Nr1ReportPage() {
  await ensureDb();
  const session = await requireSession();
  if (!canViewDocs(session.role)) redirect("/dashboard");
  const r = await buildNr1Report(session.organizationId);

  return (
    <div className="report container">
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <a href="/documents" className="nav-link">← Voltar</a>
        <PrintButton />
      </div>

      <h1>Relatório NR-1 — Riscos Psicossociais</h1>
      <p className="muted">{r.organization} · gerado em {new Date(r.generatedAt).toLocaleString("pt-BR")}</p>

      <h2>1. Visão geral</h2>
      <table>
        <tbody>
          <tr><td>Riscos no inventário</td><td><strong>{r.totals.riscos}</strong></td></tr>
          <tr><td>Riscos avaliados</td><td>{r.totals.avaliados}</td></tr>
          <tr><td>Riscos priorizados</td><td>{r.totals.priorizados}</td></tr>
          <tr><td>Pesquisas aplicadas</td><td>{r.totals.pesquisas}</td></tr>
          <tr><td>Manifestações (escuta ativa)</td><td>{r.totals.manifestacoes}</td></tr>
          <tr><td>Alertas em aberto</td><td>{r.totals.alertasAbertos}</td></tr>
        </tbody>
      </table>

      <h2>2. Distribuição por nível de risco</h2>
      <table>
        <thead><tr><th>Nível</th><th>Quantidade</th></tr></thead>
        <tbody>
          {Object.entries(r.countsByLevel).map(([lvl, n]) => (
            <tr key={lvl}><td>{lvl}</td><td>{n}</td></tr>
          ))}
        </tbody>
      </table>

      <h2>3. Riscos prioritários</h2>
      {r.topRiscos.length === 0 ? (
        <p className="muted">Nenhum risco priorizado.</p>
      ) : (
        <table>
          <thead><tr><th>#</th><th>Risco</th><th>Categoria</th><th>Classificação</th><th>Score prioridade</th></tr></thead>
          <tbody>
            {r.topRiscos.map((t) => (
              <tr key={t.risco}>
                <td>{t.ranking}</td><td>{t.risco}</td><td>{t.categoria}</td><td>{t.classificacao}</td><td>{t.scorePrioridade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>4. Planos de ação (Medidas de controle)</h2>
      <table>
        <tbody>
          {Object.keys(r.plansByStatus).length === 0
            ? <tr><td className="muted">Nenhum plano de ação registrado.</td></tr>
            : Object.entries(r.plansByStatus).map(([st, n]) => <tr key={st}><td>{st}</td><td>{n}</td></tr>)}
        </tbody>
      </table>

      <p className="muted" style={{ marginTop: 32 }}>
        Documento gerado automaticamente pela Plataforma NR-1 para integração ao GRO (Gerenciamento de Riscos Ocupacionais).
      </p>
    </div>
  );
}
