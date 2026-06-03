import Link from "next/link";
import { ensureDb } from "@/src/db";
import { listSurveys } from "@/src/index";
import { canManage, requireSession } from "../lib/auth";
import { AppShell } from "../components/AppShell";
import { createSurveyAction } from "./actions";

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
        <h2 className="section-title" style={{ marginTop: 0 }}>Pesquisas ({surveys.length})</h2>

        {manage && (
          <div className="card" style={{ marginBottom: 20 }}>
            <h2>Nova pesquisa</h2>
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
