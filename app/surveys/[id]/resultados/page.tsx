import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ensureDb, prisma } from "@/src/db";
import { surveyScores, surveyAlerts, surveyHeatmap, suggestActionPlans, classify, CLASS_LABEL } from "@/src/index";
import { canManage, requireSession } from "../../../lib/auth";
import { AppShell } from "../../../components/AppShell";
import { createPlanFromSuggestionAction } from "../../actions";

export const dynamic = "force-dynamic";

const COLOR: Record<string, string> = { alto: "var(--red)", atencao: "var(--yellow)", saudavel: "var(--green)", excelente: "var(--blue)" };

function Bar({ label, score, classification }: { label: string; score: number; classification: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span>{label}</span>
        <span><strong>{score}</strong> <span className="hint">· {CLASS_LABEL[classification as keyof typeof CLASS_LABEL]}</span></span>
      </div>
      <div style={{ height: 10, background: "var(--card-2)", borderRadius: 6, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${score}%`, background: COLOR[classification] }} />
      </div>
    </div>
  );
}

export default async function ResultadosPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ plan?: string }> }) {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) redirect("/dashboard");
  const { id } = await params;
  const { plan } = await searchParams;
  const survey = await prisma.survey.findFirst({ where: { id, organizationId: session.organizationId }, select: { title: true, anonymous: true } });
  if (!survey) notFound();
  const [r, alerts, heat, plans] = await Promise.all([surveyScores(id), surveyAlerts(id), surveyHeatmap(id), suggestActionPlans(id)]);

  // Anonimato: não mostrar indicadores com menos de 5 respostas.
  const MIN = 5;
  const enough = r.responses >= MIN;

  return (
    <AppShell session={session} active="surveys" title={`Resultados — ${survey.title}`} subtitle="Indicadores por dimensão e índice geral" showReport={false}>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <Link href={`/surveys/${id}`} className="btn-ghost btn-sm">← Voltar à pesquisa</Link>
        <Link href={`/surveys/${id}/relatorio`} className="btn btn-sm" style={{ width: "auto" }}>📄 Relatório executivo (PDF)</Link>
      </div>
      {plan && <p className="success" style={{ marginBottom: 16 }}>Plano de ação criado a partir da sugestão. Acompanhe em Riscos → Planos.</p>}

      {enough && alerts.length > 0 && (
        <div className="card" style={{ marginBottom: 20, borderLeft: "4px solid var(--red)" }}>
          <h2 className="section-title" style={{ marginTop: 0 }}>⚠️ Alertas ({alerts.length})</h2>
          {alerts.map((a, i) => (
            <p key={i} style={{ margin: "6px 0" }}>
              <span className={`badge ${a.severity === "alto" ? "CRITICAL" : "HIGH"}`}>{a.severity === "alto" ? "Alto" : "Médio"}</span>{" "}
              <strong>{a.title}</strong>{a.confidential && " 🔒"} — <span className="hint">{a.description}</span>
            </p>
          ))}
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 28 }}>
          <div><div className="stat-label">Respostas</div><strong style={{ fontSize: 24 }}>{r.responses}</strong></div>
          <div><div className="stat-label">Índice Geral de Saúde Org.</div><strong style={{ fontSize: 24, color: COLOR[r.general.classification] }}>{enough ? r.general.score : "—"}</strong> <span className="hint">{enough ? CLASS_LABEL[r.general.classification] : ""}</span></div>
          <div><div className="stat-label">Risco Psicossocial Geral</div><strong style={{ fontSize: 24, color: COLOR[r.riskGeneral.classification] }}>{enough ? r.riskGeneral.score : "—"}</strong></div>
          {r.enps && <div><div className="stat-label">eNPS</div><strong style={{ fontSize: 24 }}>{enough ? r.enps.value : "—"}</strong> {enough && <span className="hint">{r.enps.promoters}P · {r.enps.neutros}N · {r.enps.detractors}D</span>}</div>}
        </div>
      </div>

      {!enough ? (
        <div className="card"><p className="stat-label">Para preservar o anonimato, os indicadores por dimensão só aparecem com no mínimo {MIN} respostas (atual: {r.responses}).</p></div>
      ) : r.dimensions.length === 0 ? (
        <div className="card"><p className="stat-label">Sem respostas pontuáveis ainda. As dimensões aparecem conforme a pesquisa é respondida.</p></div>
      ) : (
        <div className="card">
          <h2 className="section-title" style={{ marginTop: 0 }}>Indicadores por dimensão</h2>
          {r.dimensions.map((d) => <Bar key={d.key} label={d.label} score={d.score} classification={d.classification} />)}
          <p className="hint" style={{ marginTop: 12 }}>Escala: 0–49 risco alto · 50–69 atenção · 70–84 saudável · 85–100 excelente. Perguntas negativas têm pontuação invertida.</p>
        </div>
      )}

      {enough && heat.rows.length > 0 && (
        <div className="card" style={{ marginTop: 20, overflowX: "auto" }}>
          <h2 className="section-title" style={{ marginTop: 0 }}>Mapa de calor por setor</h2>
          <table>
            <thead>
              <tr><th>Setor</th><th>Resp.</th>{heat.dimensions.map((d) => <th key={d.key} style={{ fontSize: 11 }}>{d.label}</th>)}<th>Geral</th></tr>
            </thead>
            <tbody>
              {heat.rows.map((row) => (
                <tr key={row.departmentId}>
                  <td><strong>{row.name}</strong></td>
                  <td className="hint">{row.responses}</td>
                  {row.cells.map((c) => (
                    <td key={c.dimension} style={{ textAlign: "center", color: "#fff", background: COLOR[c.classification], fontWeight: 600 }}>{c.score}</td>
                  ))}
                  <td style={{ textAlign: "center", color: "#fff", background: COLOR[classify(row.general)], fontWeight: 700 }}>{row.general}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint" style={{ marginTop: 10 }}>🟢 saudável · 🟡 atenção · 🔴 risco alto. Só setores com ≥ {MIN} respostas (anonimato).</p>
        </div>
      )}

      {enough && plans.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <h2 className="section-title" style={{ marginTop: 0 }}>Planos de ação sugeridos (5W2H)</h2>
          {plans.map((p, i) => (
            <div key={i} style={{ borderBottom: "1px solid var(--border)", padding: "10px 0" }}>
              <strong>{p.risco}</strong>
              <p className="hint" style={{ margin: "4px 0" }}><b>O quê:</b> {p.oQue} · <b>Como:</b> {p.como} · <b>Quem:</b> {p.quem} · <b>Quando:</b> {p.quando}</p>
              <form action={createPlanFromSuggestionAction}>
                <input type="hidden" name="surveyId" value={id} />
                <input type="hidden" name="title" value={`[${p.dimension}] ${p.oQue}`} />
                <input type="hidden" name="description" value={`${p.porQue}. Quem: ${p.quem}. Como: ${p.como}. Onde: ${p.onde}. Indicador: ${p.indicador}.`} />
                <input type="hidden" name="days" value="30" />
                <button type="submit" className="btn-ghost btn-sm">Criar plano de ação</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
