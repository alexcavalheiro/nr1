import { ensureDb } from "@/src/db";
import { listTracks } from "@/src/index";
import { canManage, requireSession } from "../lib/auth";
import { AppShell } from "../components/AppShell";
import { IconCheck, IconPlay } from "../components/icons";
import { addContentAction, completeAction, createTrackAction } from "./actions";

export const dynamic = "force-dynamic";

const THEMES: Record<string, string> = {
  EMOTIONAL_INTELLIGENCE: "Inteligência emocional", STRESS_MANAGEMENT: "Gestão do estresse",
  COMMUNICATION: "Comunicação", LEADERSHIP: "Liderança", MENTAL_HEALTH: "Saúde mental",
  RESILIENCE: "Resiliência", PSYCHOLOGICAL_SAFETY: "Segurança psicológica",
};
const CONTENT_TYPES: Record<string, string> = {
  VIDEO: "Vídeo", PODCAST: "Podcast", EBOOK: "E-book", LEARNING_PILL: "Pílula", TRACK: "Trilha",
};

export default async function LearningPage() {
  await ensureDb();
  const session = await requireSession();
  const manage = canManage(session.role);
  const tracks = await listTracks(session.organizationId, session.userId);

  return (
    <AppShell session={session} active="learning" title="Aprendizagem" subtitle="Desenvolvimento socioemocional e cultura preventiva" showReport={false}>
      {manage && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2>Nova trilha</h2>
          <form action={createTrackAction} className="form-row">
            <input name="title" placeholder="Título da trilha" required style={{ flex: 2 }} />
            <select name="theme" required>
              {Object.entries(THEMES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input name="description" placeholder="Descrição (opcional)" style={{ flex: 2 }} />
            <button className="btn" style={{ width: "auto" }} type="submit">Criar trilha</button>
          </form>
        </div>
      )}

      {tracks.length === 0 ? (
        <div className="card"><p className="stat-label">Nenhuma trilha disponível ainda.</p></div>
      ) : (
        tracks.map((t) => {
          const total = t.contents.length;
          const done = t.contents.filter((c) => c.progress[0]?.status === "COMPLETED").length;
          const pct = total ? Math.round((done / total) * 100) : 0;
          return (
            <div className="card" key={t.id} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <strong style={{ fontSize: 15 }}>{t.title}</strong>
                  <div style={{ marginTop: 4 }}><span className="badge AI">{THEMES[t.theme] ?? t.theme}</span></div>
                  {t.description && <p className="stat-label" style={{ marginTop: 6 }}>{t.description}</p>}
                </div>
                <div style={{ textAlign: "right", minWidth: 120 }}>
                  <div className="stat-label">{done}/{total} concluídos</div>
                  <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
                </div>
              </div>

              {t.contents.length > 0 && (
                <ul className="insights" style={{ marginTop: 14 }}>
                  {t.contents.map((c) => {
                    const completed = c.progress[0]?.status === "COMPLETED";
                    return (
                      <li key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span className="content-ico"><IconPlay /></span>
                          {c.title} <span className="stat-label">· {CONTENT_TYPES[c.type] ?? c.type}</span>
                        </span>
                        {completed ? (
                          <span className="badge LOW"><IconCheck /> Concluído</span>
                        ) : (
                          <form action={completeAction}>
                            <input type="hidden" name="contentId" value={c.id} />
                            <button className="btn-ghost btn-sm" type="submit">Marcar como concluído</button>
                          </form>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {manage && (
                <form action={addContentAction} className="form-row" style={{ marginTop: 12 }}>
                  <input type="hidden" name="trackId" value={t.id} />
                  <input name="title" placeholder="Novo conteúdo" required style={{ flex: 2 }} />
                  <select name="type" required>
                    {Object.entries(CONTENT_TYPES).filter(([v]) => v !== "TRACK").map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <input name="mediaUrl" placeholder="URL (opcional)" style={{ flex: 1 }} />
                  <button className="btn-ghost btn-sm" type="submit">Adicionar</button>
                </form>
              )}
            </div>
          );
        })
      )}
    </AppShell>
  );
}
