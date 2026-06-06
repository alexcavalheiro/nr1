import Link from "next/link";
import { ensureDb } from "@/src/db";
import { listSurveys, SURVEY_TEMPLATES } from "@/src/index";
import { canManage, requireSession } from "../lib/auth";
import { AppShell } from "../components/AppShell";
import { createFromTemplateAction, createSurveyAction } from "./actions";

export const dynamic = "force-dynamic";

export const SURVEY_TYPES: Record<string, string> = {
  CLIMATE: "Clima", EMOTIONAL_HEALTH: "Saúde emocional", PSYCHOSOCIAL: "Psicossocial",
  LEADERSHIP_EVAL: "Avaliação de liderança", STRUCTURED_INTERVIEW: "Entrevista estruturada",
  ENVIRONMENT_CHECKLIST: "Checklist de ambiente", PULSE: "Pulse",
};
const STATUS_LABEL: Record<string, string> = { DRAFT: "Rascunho", OPEN: "Aberta", CLOSED: "Fechada", ARCHIVED: "Arquivada" };

export default async function SurveysPage() {
  await ensureDb();
  const session = await requireSession();
  const manage = canManage(session.role);
  const surveys = await listSurveys(session.organizationId);

  return (
    <AppShell session={session} active="surveys" title="Pesquisas" subtitle="Diagnóstico e coleta de dados psicossociais">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h2 className="section-title" style={{ marginTop: 0 }}>Pesquisas ({surveys.length})</h2>
          {manage && <Link href="/surveys/historico" className="btn-ghost btn-sm">📈 Comparativo histórico</Link>}
        </div>

        {manage && (
          <div className="card" style={{ marginBottom: 20 }}>
            <h2>Modelos prontos</h2>
            <p className="stat-label" style={{ marginBottom: 12 }}>Comece por um modelo já estruturado (blocos, perguntas e dimensões de score).</p>
            <div className="grid-2" style={{ gap: 12 }}>
              {SURVEY_TEMPLATES.map((t) => (
                <div key={t.key} className="card" style={{ margin: 0 }}>
                  <strong>{t.title}</strong>
                  <p className="hint" style={{ margin: "6px 0 10px" }}>{t.description}</p>
                  <form action={createFromTemplateAction} className="form-row">
                    <input type="hidden" name="templateKey" value={t.key} />
                    <select name="anonymous" className="btn-sm" style={{ width: "auto" }}>
                      <option value="yes">Anônima</option>
                      <option value="no">Identificada</option>
                    </select>
                    <button className="btn btn-sm" style={{ width: "auto" }} type="submit">Usar modelo</button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        )}

        {manage && (
          <div className="card" style={{ marginBottom: 20 }}>
            <h2>Nova pesquisa em branco</h2>
            <form action={createSurveyAction} className="form-row">
              <input name="title" placeholder="Título da pesquisa" required style={{ flex: 2 }} />
              <select name="type" required style={{ flex: 1 }}>
                {Object.entries(SURVEY_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <button className="btn" style={{ width: "auto" }} type="submit">Criar</button>
            </form>
          </div>
        )}

        <div className="card">
          {surveys.length === 0 ? (
            <p className="stat-label">Nenhuma pesquisa criada.</p>
          ) : (
            <table>
              <thead>
                <tr><th>Pesquisa</th><th>Tipo</th><th>Status</th><th>Versão</th><th>Respostas</th></tr>
              </thead>
              <tbody>
                {surveys.map((s) => (
                  <tr key={s.id}>
                    <td><Link href={`/surveys/${s.id}`}>{s.title}</Link></td>
                    <td className="muted">{SURVEY_TYPES[s.type] ?? s.type}</td>
                    <td>{STATUS_LABEL[s.status] ?? s.status}</td>
                    <td className="muted">{s.currentVersion ? `v${s.currentVersion.version}` : "—"}</td>
                    <td>{s._count.responses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
    </AppShell>
  );
}
