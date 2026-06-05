import Link from "next/link";
import { ensureDb, prisma } from "@/src/db";
import { listRisks, scopedDepartmentIds } from "@/src/index";
import { canManage, requireSession } from "../lib/auth";
import { AppShell } from "../components/AppShell";
import { createRiskAction } from "./actions";

export const dynamic = "force-dynamic";

const LEVEL_LABEL: Record<string, string> = { LOW: "Baixo", MODERATE: "Moderado", HIGH: "Alto", CRITICAL: "Crítico" };
const STATUS_LABEL: Record<string, string> = {
  IDENTIFIED: "Identificado", ASSESSED: "Avaliado", PRIORITIZED: "Priorizado",
  IN_TREATMENT: "Em tratamento", MONITORED: "Monitorado", CLOSED: "Encerrado",
};

export default async function RisksPage() {
  await ensureDb();
  const session = await requireSession();
  const orgId = session.organizationId;
  const manage = canManage(session.role);

  // Acesso por escopo: gestores/auditor veem tudo; demais só a subárvore do seu setor.
  const deptScope = await scopedDepartmentIds(session);
  const [risks, categories, departments] = await Promise.all([
    listRisks(orgId, deptScope),
    prisma.riskCategory.findMany({ orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" } }),
  ]);

  return (
    <AppShell session={session} active="risks" title="Riscos" subtitle="Inventário e ciclo de avaliação NR-1">
        <h2 className="section-title" style={{ marginTop: 0 }}>Inventário de riscos ({risks.length})</h2>

        {manage && (
          <div className="card" style={{ marginBottom: 20 }}>
            <h2>Novo risco</h2>
            <form action={createRiskAction} className="form-row">
              <input name="title" placeholder="Título do risco" required style={{ flex: 2 }} />
              <select name="categoryId" required style={{ flex: 1 }}>
                <option value="">Categoria…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select name="departmentId" style={{ flex: 1 }}>
                <option value="">Setor (opcional)</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <button className="btn" style={{ width: "auto" }} type="submit">Criar</button>
            </form>
          </div>
        )}

        <div className="card">
          {risks.length === 0 ? (
            <p className="stat-label">Nenhum risco no inventário.</p>
          ) : (
            <table>
              <thead>
                <tr><th>Risco</th><th>Categoria</th><th>Setor</th><th>Status</th><th>Nível</th><th>Prioridade</th><th>Planos</th></tr>
              </thead>
              <tbody>
                {risks.map((r) => {
                  const level = r.assessments[0]?.classification;
                  return (
                    <tr key={r.id}>
                      <td><Link href={`/risks/${r.id}`}>{r.title}</Link></td>
                      <td className="muted">{r.category.name}</td>
                      <td className="muted">{r.department?.name ?? "—"}</td>
                      <td>{STATUS_LABEL[r.status] ?? r.status}</td>
                      <td>{level ? <span className={`badge ${level}`}>{LEVEL_LABEL[level]}</span> : "—"}</td>
                      <td>{r.prioritization?.rank ? `#${r.prioritization.rank} (${r.prioritization.priorityScore})` : "—"}</td>
                      <td>{r._count.actionPlans}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
    </AppShell>
  );
}
