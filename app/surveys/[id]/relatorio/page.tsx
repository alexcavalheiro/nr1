import { notFound, redirect } from "next/navigation";
import { ensureDb } from "@/src/db";
import { surveyExecutiveReport, CLASS_LABEL } from "@/src/index";
import { canManage, requireSession } from "../../../lib/auth";
import { PrintButton } from "../../../components/PrintButton";

export const dynamic = "force-dynamic";
const fmtDT = (d: Date | string) => new Date(d).toLocaleString("pt-BR");

export default async function RelatorioExecutivoPage({ params }: { params: Promise<{ id: string }> }) {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) redirect("/dashboard");
  const { id } = await params;
  const r = await surveyExecutiveReport(session.organizationId, id);
  if (!r) notFound();

  const enough = r.scores.responses >= 5;

  return (
    <div className="report container">
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <a href={`/surveys/${id}/resultados`} className="nav-link">← Resultados</a>
        <PrintButton />
      </div>

      <h1>Relatório Executivo — {r.survey.title}</h1>
      <p className="muted">{r.org} · gerado em {fmtDT(r.generatedAt)} · {r.survey.anonymous ? "Anônima" : "Identificada"}</p>

      <h2>1. Resumo executivo</h2>
      <table><tbody>
        <tr><td>Total de respondentes</td><td><strong>{r.scores.responses}</strong></td></tr>
        <tr><td>Índice Geral de Saúde Organizacional</td><td><strong>{enough ? `${r.scores.general.score} (${CLASS_LABEL[r.scores.general.classification]})` : "— (mín. 5 respostas)"}</strong></td></tr>
        <tr><td>Risco Psicossocial Geral</td><td>{enough ? r.scores.riskGeneral.score : "—"}</td></tr>
        <tr><td>eNPS</td><td>{enough && r.scores.enps ? r.scores.enps.value : "—"}</td></tr>
        <tr><td>Alertas críticos</td><td>{r.alerts.length}</td></tr>
      </tbody></table>

      {enough && (
        <>
          <h2>2. Indicadores por dimensão</h2>
          <table>
            <thead><tr><th>Dimensão</th><th>Score</th><th>Classificação</th></tr></thead>
            <tbody>{r.scores.dimensions.map((d) => <tr key={d.key}><td>{d.label}</td><td>{d.score}</td><td>{CLASS_LABEL[d.classification]}</td></tr>)}</tbody>
          </table>

          <h2>3. Pontos fortes</h2>
          {r.strong.length === 0 ? <p className="muted">—</p> : <ul>{r.strong.map((d) => <li key={d.key}>{d.label}: {d.score} ({CLASS_LABEL[d.classification]})</li>)}</ul>}

          <h2>4. Pontos críticos</h2>
          {r.critical.length === 0 ? <p className="muted">Nenhum ponto abaixo de saudável.</p> : <ul>{r.critical.map((d) => <li key={d.key}>{d.label}: {d.score} ({CLASS_LABEL[d.classification]})</li>)}</ul>}
        </>
      )}

      <h2>5. Alertas de risco</h2>
      {r.alerts.length === 0 ? <p className="muted">Nenhum alerta disparado.</p> : (
        <table>
          <thead><tr><th>Alerta</th><th>Gravidade</th><th>Descrição</th></tr></thead>
          <tbody>{r.alerts.map((a, i) => <tr key={i}><td>{a.title}{a.confidential ? " 🔒" : ""}</td><td>{a.severity === "alto" ? "Alta" : "Média"}</td><td>{a.description}</td></tr>)}</tbody>
        </table>
      )}

      <h2>6. Evidências qualitativas (respostas abertas)</h2>
      <p className="muted">{r.open.total} respostas abertas · {r.open.sentiment.negativo} negativas, {r.open.sentiment.neutro} neutras, {r.open.sentiment.positivo} positivas.</p>
      {r.open.topThemes.length > 0 && (
        <p><strong>Temas recorrentes:</strong> {r.open.topThemes.map((t) => `${t.label} (${t.count})`).join(" · ")}</p>
      )}
      {r.open.flagged.length > 0 && (
        <>
          <p><strong>Trechos que pedem atenção:</strong></p>
          <ul>{r.open.flagged.map((f, i) => <li key={i}>"{f.text}" <span className="muted">— {f.themes.join(", ") || "geral"} · gravidade {f.severity}</span></li>)}</ul>
        </>
      )}

      <h2>7. Plano de ação sugerido (5W2H)</h2>
      {r.plans.length === 0 ? <p className="muted">Sem riscos que exijam plano no momento.</p> : r.plans.map((p, i) => (
        <table key={i} style={{ marginBottom: 14 }}>
          <thead><tr><th colSpan={2}>{p.risco}</th></tr></thead>
          <tbody>
            <tr><td>O quê</td><td>{p.oQue}</td></tr>
            <tr><td>Por quê</td><td>{p.porQue}</td></tr>
            <tr><td>Quem</td><td>{p.quem}</td></tr>
            <tr><td>Quando</td><td>{p.quando}</td></tr>
            <tr><td>Onde</td><td>{p.onde}</td></tr>
            <tr><td>Como</td><td>{p.como}</td></tr>
            <tr><td>Indicador</td><td>{p.indicador}</td></tr>
          </tbody>
        </table>
      ))}

      <p className="muted" style={{ marginTop: 28 }}>
        Relatório gerado pela Plataforma NR-1 em {fmtDT(r.generatedAt)}. Dados agregados — anonimato preservado (mín. 5 respostas por recorte). Alertas com 🔒 são confidenciais.
      </p>
    </div>
  );
}
