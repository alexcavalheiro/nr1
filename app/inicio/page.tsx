import Link from "next/link";
import { ensureDb } from "@/src/db";
import { collaboratorHome } from "@/src/index";
import { requireSession } from "../lib/auth";
import { AppShell } from "../components/AppShell";

export const dynamic = "force-dynamic";

const SURVEY_TYPE: Record<string, string> = {
  CLIMATE: "Clima", PSYCHOSOCIAL: "Psicossocial", PULSE: "Pulso", CUSTOM: "Pesquisa",
};

export default async function InicioPage() {
  await ensureDb();
  const session = await requireSession();
  const { pendingSurveys, learning } = await collaboratorHome(session.organizationId, session.userId);
  const firstName = session.name.split(/\s+/)[0];

  return (
    <AppShell session={session} active="inicio" title={`Olá, ${firstName} 👋`} subtitle="O que precisa da sua atenção hoje" showReport={false}>
      <div className="grid-2">
        <div className="card">
          <h2 className="section-title" style={{ marginTop: 0 }}>Pesquisas para responder ({pendingSurveys.length})</h2>
          {pendingSurveys.length === 0 ? (
            <p className="stat-label">Nenhuma pesquisa aberta no momento. 🎉</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {pendingSurveys.map((s) => (
                <li key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  <span><span className="badge AI" style={{ marginRight: 8 }}>{SURVEY_TYPE[s.type] ?? s.type}</span>{s.title}</span>
                  <Link href={`/surveys/${s.id}/respond`} className="btn btn-sm" style={{ width: "auto" }}>Responder</Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="section-title" style={{ marginTop: 0 }}>Minha aprendizagem</h2>
          {learning.length === 0 ? (
            <p className="stat-label">Nenhuma trilha disponível ainda.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {learning.map((t) => (
                <li key={t.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{t.title}</span>
                    <span className="hint">{t.done}/{t.total}</span>
                  </div>
                  <div style={{ height: 6, background: "var(--card-2)", borderRadius: 4, marginTop: 6, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${t.total ? (t.done / t.total) * 100 : 0}%`, background: "var(--ai)" }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link href="/learning" className="btn-ghost btn-sm" style={{ marginTop: 12, display: "inline-block" }}>Ver aprendizagem →</Link>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h2 className="section-title" style={{ marginTop: 0 }}>Atalhos</h2>
        <div className="form-row" style={{ flexWrap: "wrap" }}>
          <Link href="/listening" className="btn-ghost btn-sm">Fazer um relato / escuta</Link>
          <Link href="/learning" className="btn-ghost btn-sm">Aprendizagem</Link>
          <Link href="/account" className="btn-ghost btn-sm">Minha conta</Link>
        </div>
      </div>
    </AppShell>
  );
}
