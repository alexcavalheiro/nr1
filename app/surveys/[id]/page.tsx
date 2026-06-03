import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureDb, prisma } from "@/src/db";
import { getSurveyDetail } from "@/src/index";
import { canManage, requireSession } from "../../lib/auth";
import { AppShell } from "../../components/AppShell";
import { SURVEY_TYPES } from "../page";
import { addQuestionAction, deriveRisksAction, publishSurveyAction } from "../actions";

export const dynamic = "force-dynamic";

const QUESTION_TYPES: Record<string, string> = {
  LIKERT_5: "Likert 1-5", SCALE_0_10: "Escala 0-10", YES_NO: "Sim/Não",
  OPEN_TEXT: "Texto aberto", SINGLE_CHOICE: "Escolha única", MULTIPLE_CHOICE: "Múltipla escolha",
};

export default async function SurveyDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ responded?: string }>;
}) {
  await ensureDb();
  const session = await requireSession();
  const { id } = await params;
  const { responded } = await searchParams;
  const survey = await getSurveyDetail(session.organizationId, id);
  if (!survey) notFound();
  const manage = canManage(session.role);

  const draft = survey.versions.find((v) => v.status === "DRAFT");
  const published = survey.versions.find((v) => v.status === "PUBLISHED");
  const categories = manage ? await prisma.riskCategory.findMany({ orderBy: { name: "asc" } }) : [];

  return (
    <AppShell session={session} active="surveys" title={survey.title} subtitle="Questionário e derivação de riscos">
        <Link href="/surveys" className="nav-link">← Voltar às pesquisas</Link>
        <p className="muted" style={{ marginTop: 8 }}>{SURVEY_TYPES[survey.type] ?? survey.type} · {survey._count.responses} respostas</p>
        {responded && <div className="card" style={{ borderColor: "var(--low)", marginBottom: 16 }}>✓ Resposta registrada. Obrigado!</div>}

        {/* PUBLICADA */}
        {published && (
          <>
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ margin: 0 }}>Pesquisa publicada (v{published.version})</h2>
                <Link href={`/surveys/${survey.id}/respond`} className="btn" style={{ width: "auto", textDecoration: "none", padding: "8px 14px" }}>Responder →</Link>
              </div>
              <ul className="insights">
                {published.questions.map((q) => (
                  <li key={q.id}>
                    {q.text} <span className="muted">· {QUESTION_TYPES[q.type] ?? q.type}{q.riskCategory ? ` · risco: ${q.riskCategory.name}` : ""}</span>
                  </li>
                ))}
              </ul>
            </div>
            {manage && (
              <div className="card">
                <h2>Derivar riscos das respostas</h2>
                <p className="stat-label">Calcula a média das perguntas mapeadas a riscos e gera itens no inventário (com rastreabilidade).</p>
                <form action={deriveRisksAction}>
                  <input type="hidden" name="surveyId" value={survey.id} />
                  <button className="btn" style={{ width: "auto" }} type="submit" disabled={survey._count.responses === 0}>
                    Derivar riscos ({survey._count.responses} respostas)
                  </button>
                </form>
              </div>
            )}
          </>
        )}

        {/* RASCUNHO (montagem do questionário) */}
        {!published && draft && (
          manage ? (
            <>
              <div className="card" style={{ marginBottom: 16 }}>
                <h2>Adicionar pergunta (rascunho v{draft.version})</h2>
                <form action={addQuestionAction} className="form-row">
                  <input type="hidden" name="surveyId" value={survey.id} />
                  <input type="hidden" name="versionId" value={draft.id} />
                  <input name="text" placeholder="Texto da pergunta" required style={{ flex: 2 }} />
                  <select name="type" required>
                    {Object.entries(QUESTION_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <select name="riskCategoryId">
                    <option value="">Sem mapeamento</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button className="btn" style={{ width: "auto" }} type="submit">Adicionar</button>
                </form>
              </div>
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h2 style={{ margin: 0 }}>Perguntas ({draft.questions.length})</h2>
                  <form action={publishSurveyAction}>
                    <input type="hidden" name="surveyId" value={survey.id} />
                    <input type="hidden" name="versionId" value={draft.id} />
                    <button className="btn" style={{ width: "auto" }} type="submit" disabled={draft.questions.length === 0}>Publicar pesquisa</button>
                  </form>
                </div>
                {draft.questions.length === 0 ? (
                  <p className="stat-label">Adicione perguntas antes de publicar.</p>
                ) : (
                  <ul className="insights">
                    {draft.questions.map((q) => (
                      <li key={q.id}>{q.text} <span className="muted">· {QUESTION_TYPES[q.type] ?? q.type}{q.riskCategory ? ` · risco: ${q.riskCategory.name}` : ""}</span></li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <div className="card"><p className="stat-label">Pesquisa em preparação.</p></div>
          )
        )}
    </AppShell>
  );
}
