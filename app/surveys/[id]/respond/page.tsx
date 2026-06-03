import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureDb } from "@/src/db";
import { getSurveyForResponse } from "@/src/index";
import { requireSession } from "../../../lib/auth";
import { AppShell } from "../../../components/AppShell";
import { submitResponseAction } from "../../actions";

export const dynamic = "force-dynamic";

function Field({ id, type }: { id: string; type: string }) {
  const name = `q_${id}`;
  if (type === "OPEN_TEXT") return <textarea name={name} rows={2} style={{ width: "100%" }} />;
  if (type === "YES_NO")
    return (
      <select name={name} defaultValue="">
        <option value="" disabled>Selecione…</option>
        <option value="5">Sim</option>
        <option value="1">Não</option>
      </select>
    );
  if (type === "SCALE_0_10")
    return (
      <select name={name} defaultValue="">
        <option value="" disabled>0–10</option>
        {Array.from({ length: 11 }, (_, n) => <option key={n} value={n}>{n}</option>)}
      </select>
    );
  if (type === "LIKERT_5")
    return (
      <select name={name} defaultValue="">
        <option value="" disabled>1–5</option>
        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    );
  return <input name={name} style={{ width: "100%" }} />;
}

export default async function RespondPage({ params }: { params: Promise<{ id: string }> }) {
  await ensureDb();
  const session = await requireSession();
  const { id } = await params;
  const survey = await getSurveyForResponse(session.organizationId, id);
  if (!survey?.currentVersion) notFound();

  return (
    <AppShell session={session} active="surveys" title={survey.title} subtitle="Responder pesquisa" showReport={false}>
        <Link href={`/surveys/${survey.id}`} className="nav-link">← Voltar</Link>
        {survey.anonymous && <p className="hint" style={{ marginTop: 8 }}>Respostas anônimas — sua identidade não é vinculada.</p>}
        <div className="card">
          <form action={submitResponseAction}>
            <input type="hidden" name="surveyId" value={survey.id} />
            {survey.currentVersion.questions.map((q, idx) => (
              <div key={q.id} style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 6 }}>{idx + 1}. {q.text}</label>
                <Field id={q.id} type={q.type} />
              </div>
            ))}
            <button className="btn" style={{ width: "auto" }} type="submit">Enviar resposta</button>
          </form>
        </div>
    </AppShell>
  );
}
