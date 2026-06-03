import Link from "next/link";
import { ensureDb, prisma } from "@/src/db";
import { getHeatmap, getRanking } from "@/src/index";
import { requireSession } from "../lib/auth";
import { AppShell } from "../components/AppShell";
import { RiskDonut } from "../components/RiskDonut";
import { IconAlert, IconBell, IconChevronRight, IconShield, IconSparkles } from "../components/icons";

export const dynamic = "force-dynamic";

const LEVEL_LABEL: Record<string, string> = { LOW: "Baixo", MODERATE: "Moderado", HIGH: "Alto", CRITICAL: "Crítico" };
const tone = (l?: string) => (l ? l.toLowerCase() : undefined);

export default async function Dashboard() {
  await ensureDb();
  const session = await requireSession();
  const orgId = session.organizationId;

  const [heatmap, ranking, openAlerts, insights, summary] = await Promise.all([
    getHeatmap(orgId),
    getRanking(orgId, 6),
    prisma.alert.count({ where: { organizationId: orgId, resolved: false } }),
    prisma.aiInsight.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, take: 4 }),
    prisma.executiveSummary.findFirst({ where: { organizationId: orgId }, orderBy: { generatedAt: "desc" } }),
  ]);

  const totalRisks = Object.values(heatmap.countsByLevel).reduce((a, b) => a + b, 0);
  const levelByRisk = new Map(heatmap.cells.map((c) => [c.riskId, c.level]));
  const recs = (summary?.content ?? "").split("\n").map((s) => s.trim()).filter((l) => l.startsWith("- ")).map((l) => l.slice(2));

  return (
    <AppShell session={session} active="dashboard" title="Dashboard NR-1" subtitle="Visão geral dos riscos psicossociais e alertas organizacionais">
      {/* Linha 1 — indicadores */}
      <div className="grid row">
        <div className="card stat-card">
          <div className="stat-ico" data-tone="ai"><IconShield /></div>
          <div className="stat-label">Riscos no inventário</div>
          <div className="stat">{totalRisks}</div>
          <div className="stat-foot">avaliados e ativos</div>
        </div>
        <div className="card stat-card">
          <div className="stat-ico" data-tone="critical"><IconAlert /></div>
          <div className="stat-label">Riscos críticos</div>
          <div className="stat" data-tone="critical">{heatmap.countsByLevel.CRITICAL}</div>
          <div className="stat-foot">exigem ação imediata</div>
        </div>
        <div className="card stat-card">
          <div className="stat-ico" data-tone="high"><IconBell /></div>
          <div className="stat-label">Alertas abertos</div>
          <div className="stat" data-tone="high">{openAlerts}</div>
          <div className="stat-foot">não resolvidos</div>
        </div>
        <div className="card stat-card">
          <div className="stat-ico" data-tone="ai"><IconSparkles /></div>
          <div className="stat-label">Insights de IA</div>
          <div className="stat" data-tone="ai">{insights.length}</div>
          <div className="stat-foot">gerados pelos agentes</div>
        </div>
      </div>

      {/* Linha 2 — distribuição + ranking */}
      <div className="grid-2 row">
        <div className="card">
          <h2>Distribuição de riscos por nível</h2>
          <RiskDonut counts={heatmap.countsByLevel} />
        </div>
        <div className="card">
          <h2>Ranking de priorização</h2>
          {ranking.length === 0 ? (
            <p className="stat-label">Nenhum risco priorizado ainda.</p>
          ) : (
            <table>
              <thead><tr><th>#</th><th>Risco</th><th>Categoria</th><th>Nível</th><th>Score</th><th></th></tr></thead>
              <tbody>
                {ranking.map((r) => {
                  const lvl = levelByRisk.get(r.risk.id);
                  return (
                    <tr key={r.id} className={lvl === "CRITICAL" ? "row-critical" : undefined}>
                      <td><strong>{r.rank}</strong></td>
                      <td>{r.risk.title}</td>
                      <td className="stat-label">{r.risk.category.name}</td>
                      <td>{lvl ? <span className={`badge ${lvl}`}>{LEVEL_LABEL[lvl]}</span> : "—"}</td>
                      <td><span className="score-badge">{r.priorityScore}</span></td>
                      <td><Link className="link-btn" href={`/risks/${r.risk.id}`}>Ver detalhes <IconChevronRight /></Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Linha 3 — insights + resumo executivo */}
      <div className="grid-2">
        <div className="card">
          <h2>Insights recentes (IA)</h2>
          {insights.length === 0 ? (
            <p className="stat-label">Sem insights no período.</p>
          ) : (
            insights.map((i) => (
              <div className="insight-card" key={i.id}>
                <div className="insight-ico" data-tone={tone(i.severity ?? "ai")} style={{ background: "rgba(255,255,255,0.04)" }}>
                  <IconAlert />
                </div>
                <div className="insight-body">
                  <div className="insight-top">
                    {i.severity && <span className={`badge ${i.severity}`}>{LEVEL_LABEL[i.severity]}</span>}
                    <span className="stat-label">{i.type === "TREND" ? "Tendência" : i.type === "RISK_DETECTION" ? "Detecção de risco" : "Insight"}</span>
                  </div>
                  <div className="insight-text">{i.summary}</div>
                  <div className="insight-actions">
                    {i.relatedRiskId
                      ? <Link className="btn-ghost btn-sm" href={`/risks/${i.relatedRiskId}`}>Criar plano de ação</Link>
                      : <Link className="btn-ghost btn-sm" href="/risks">Analisar</Link>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="card exec-card">
          <div className="exec-head">
            <div>
              <div className="exec-title"><span className="insight-ico"><IconSparkles /></span> Resumo executivo gerado por IA</div>
              {summary && <div className="exec-period">Período: {new Date(summary.periodStart).toLocaleDateString("pt-BR")} – {new Date(summary.periodEnd).toLocaleDateString("pt-BR")}</div>}
            </div>
            <Link href="/documents/report" className="btn btn-sm">Exportar PDF</Link>
          </div>
          {recs.length === 0 ? (
            <p className="stat-label">Nenhum resumo gerado ainda.</p>
          ) : (
            recs.map((rec, idx) => (
              <div className="exec-rec" key={idx}><span className="dot" />{rec}</div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
