import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureDb, prisma } from "@/src/db";
import { getRiskDetail, scopedDepartmentIds } from "@/src/index";
import { canManage, requireSession } from "../../lib/auth";
import { AppShell } from "../../components/AppShell";
import { advancePlanAction, assessAction, commentAction, createPlanAction, deleteRiskAction, evidenceAction, prioritizeAction, updateRiskAction } from "../actions";

export const dynamic = "force-dynamic";

const LEVEL_LABEL: Record<string, string> = { LOW: "Baixo", MODERATE: "Moderado", HIGH: "Alto", CRITICAL: "Crítico" };
const STATUS_LABEL: Record<string, string> = {
  IDENTIFIED: "Identificado", ASSESSED: "Avaliado", PRIORITIZED: "Priorizado",
  IN_TREATMENT: "Em tratamento", MONITORED: "Monitorado", CLOSED: "Encerrado",
};
const PLAN_STATUS: Record<string, string> = {
  CREATED: "Criado", APPROVED: "Aprovado", IN_PROGRESS: "Em execução",
  EVIDENCED: "Evidenciado", CLOSED: "Encerrado", CANCELLED: "Cancelado",
};

const Scale = ({ name }: { name: string }) => (
  <select name={name} required>
    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
  </select>
);

export default async function RiskDetail({ params }: { params: Promise<{ id: string }> }) {
  await ensureDb();
  const session = await requireSession();
  const { id } = await params;
  const risk = await getRiskDetail(session.organizationId, id);
  if (!risk) notFound();
  // Acesso por escopo: usuário restrito não abre risco fora da subárvore do seu setor.
  const scope = await scopedDepartmentIds(session);
  if (scope && !(risk.departmentId && scope.includes(risk.departmentId))) notFound();
  const manage = canManage(session.role);
  const current = risk.assessments.find((a) => a.isCurrent);
  const [categories, departments] = manage
    ? await Promise.all([
        prisma.riskCategory.findMany({ orderBy: { name: "asc" } }),
        prisma.department.findMany({ where: { organizationId: session.organizationId }, orderBy: { name: "asc" } }),
      ])
    : [[], []];

  return (
    <AppShell session={session} active="risks" title={risk.title} subtitle="Avaliação, priorização e planos de ação">
        <Link href="/risks" className="nav-link">← Voltar ao inventário</Link>
        <p className="muted" style={{ marginTop: 8 }}>
          {risk.category.name} · {risk.department?.name ?? "Corporativo"} · {STATUS_LABEL[risk.status] ?? risk.status}
          {current && <> · <span className={`badge ${current.classification}`}>{LEVEL_LABEL[current.classification]}</span></>}
        </p>

        {manage && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="form-row" style={{ justifyContent: "space-between" }}>
              <details style={{ flex: 1 }}>
                <summary className="btn-ghost btn-sm" style={{ display: "inline-block", cursor: "pointer" }}>Editar risco</summary>
                <form action={updateRiskAction} style={{ marginTop: 10 }}>
                  <input type="hidden" name="riskId" value={risk.id} />
                  <div className="form-row" style={{ marginBottom: 8 }}>
                    <input name="title" defaultValue={risk.title} placeholder="Título" required style={{ flex: 2 }} />
                    <select name="categoryId" defaultValue={risk.categoryId} style={{ flex: 1 }}>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <select name="departmentId" defaultValue={risk.departmentId ?? ""} style={{ flex: 1 }}>
                      <option value="">Corporativo</option>
                      {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div className="form-row" style={{ marginBottom: 8 }}>
                    <select name="status" defaultValue={risk.status}>
                      {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <input name="description" defaultValue={risk.description ?? ""} placeholder="Descrição (opcional)" style={{ flex: 1 }} />
                  </div>
                  <button className="btn btn-sm" style={{ width: "auto" }} type="submit">Salvar alterações</button>
                </form>
              </details>
              <form action={deleteRiskAction}>
                <input type="hidden" name="riskId" value={risk.id} />
                <button className="btn-ghost btn-sm" type="submit">Excluir risco</button>
              </form>
            </div>
          </div>
        )}

        <div className="grid-2">
          {/* Avaliação (Módulo 3) */}
          <div className="card">
            <h2>Avaliação (probabilidade × impacto)</h2>
            {current ? (
              <p>Atual: <strong>{current.probability} × {current.impact} = {current.score}</strong> → <span className={`badge ${current.classification}`}>{LEVEL_LABEL[current.classification]}</span></p>
            ) : <p className="stat-label">Ainda não avaliado.</p>}
            {manage && (
              <form action={assessAction} className="form-row">
                <input type="hidden" name="riskId" value={risk.id} />
                <label className="stat-label">Prob.</label><Scale name="probability" />
                <label className="stat-label">Impacto</label><Scale name="impact" />
                <button className="btn" style={{ width: "auto" }} type="submit">Avaliar</button>
              </form>
            )}
            {risk.assessments.length > 1 && (
              <p className="hint">{risk.assessments.length} avaliações no histórico (reavaliações preservadas).</p>
            )}
          </div>

          {/* Priorização (Módulo 4) */}
          <div className="card">
            <h2>Priorização</h2>
            {risk.prioritization ? (
              <p>Score <strong>{risk.prioritization.priorityScore}</strong>{risk.prioritization.rank ? ` · ranking #${risk.prioritization.rank}` : ""}</p>
            ) : <p className="stat-label">Ainda não priorizado.</p>}
            {manage && (
              <form action={prioritizeAction} className="form-grid">
                <input type="hidden" name="riskId" value={risk.id} />
                <label className="stat-label">Severidade</label><Scale name="severity" />
                <label className="stat-label">Frequência</label><Scale name="frequency" />
                <label className="stat-label">Imp. financeiro</label><Scale name="financialImpact" />
                <label className="stat-label">Imp. humano</label><Scale name="humanImpact" />
                <label className="stat-label">Imp. jurídico</label><Scale name="legalImpact" />
                <button className="btn" style={{ width: "auto", gridColumn: "1 / -1" }} type="submit">Priorizar</button>
              </form>
            )}
          </div>
        </div>

        {/* Planos de ação (Módulo 5) */}
        <h3 className="section-title">Planos de ação ({risk.actionPlans.length})</h3>
        {manage && (
          <div className="card" style={{ marginBottom: 16 }}>
            <form action={createPlanAction} className="form-row">
              <input type="hidden" name="riskId" value={risk.id} />
              <input name="title" placeholder="Título do plano de ação" required style={{ flex: 2 }} />
              <input name="dueDate" type="date" />
              <button className="btn" style={{ width: "auto" }} type="submit">Criar plano</button>
            </form>
          </div>
        )}
        {risk.actionPlans.map((p) => (
          <div className="card" key={p.id} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>{p.title}</strong>
              <span className="muted">{PLAN_STATUS[p.status] ?? p.status}{p.dueDate ? ` · vence ${new Date(p.dueDate).toLocaleDateString("pt-BR")}` : ""}</span>
            </div>
            {p.comments.length > 0 && (
              <ul className="insights" style={{ marginTop: 8 }}>
                {p.comments.map((c) => <li key={c.id} className="stat-label">{c.body}</li>)}
              </ul>
            )}
            {p.evidences.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <span className="stat-label">Evidências:</span>{" "}
                {p.evidences.map((e) => (
                  <a key={e.id} href={e.fileUrl} target="_blank" rel="noreferrer" className="link-btn" style={{ marginRight: 12 }}>
                    {e.description || e.fileName || "anexo"}
                  </a>
                ))}
              </div>
            )}
            {manage && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="form-row">
                  {p.status !== "CLOSED" && p.status !== "CANCELLED" && (
                    <form action={advancePlanAction}>
                      <input type="hidden" name="planId" value={p.id} />
                      <input type="hidden" name="riskId" value={risk.id} />
                      <button className="btn btn-ghost" type="submit">Avançar status →</button>
                    </form>
                  )}
                  <form action={commentAction} className="form-row" style={{ flex: 1 }}>
                    <input type="hidden" name="planId" value={p.id} />
                    <input type="hidden" name="riskId" value={risk.id} />
                    <input name="body" placeholder="Comentário…" style={{ flex: 1 }} />
                    <button className="btn btn-ghost" type="submit">Comentar</button>
                  </form>
                </div>
                <form action={evidenceAction} className="form-row">
                  <input type="hidden" name="planId" value={p.id} />
                  <input type="hidden" name="riskId" value={risk.id} />
                  <input name="fileUrl" placeholder="URL da evidência (documento, foto…)" style={{ flex: 1 }} />
                  <input name="description" placeholder="Descrição" style={{ flex: 1 }} />
                  <button className="btn btn-ghost" type="submit">Anexar evidência</button>
                </form>
              </div>
            )}
          </div>
        ))}

        {/* Rastreabilidade */}
        {risk.sources.length > 0 && (
          <>
            <h3 className="section-title">Fontes / rastreabilidade</h3>
            <div className="card">
              <ul className="insights">
                {risk.sources.map((s) => <li key={s.id}>{s.type} — {s.description ?? "—"}</li>)}
              </ul>
            </div>
          </>
        )}
    </AppShell>
  );
}
