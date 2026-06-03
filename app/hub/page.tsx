import { ensureDb } from "@/src/db";
import { listFeed } from "@/src/index";
import { canManage, requireSession } from "../lib/auth";
import { AppShell } from "../components/AppShell";
import { createPostAction } from "./actions";

export const dynamic = "force-dynamic";

const FEED_TYPES: Record<string, string> = {
  POST: "Publicação", ANNOUNCEMENT: "Comunicado", STORY: "Story", SHORT_VIDEO: "Vídeo curto",
};

function initials(name?: string) {
  return (name ?? "—").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

export default async function HubPage() {
  await ensureDb();
  const session = await requireSession();
  const manage = canManage(session.role);
  const feed = await listFeed(session.organizationId);

  return (
    <AppShell session={session} active="hub" title="Hub de convivência" subtitle="Feed corporativo, comunicados e campanhas" showReport={false}>
      {manage && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2>Publicar no feed</h2>
          <form action={createPostAction}>
            <div className="form-row" style={{ marginBottom: 10 }}>
              <select name="type" defaultValue="ANNOUNCEMENT">
                {Object.entries(FEED_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input name="title" placeholder="Título (opcional)" style={{ flex: 1 }} />
            </div>
            <textarea name="body" rows={3} placeholder="Escreva um comunicado ou publicação…" required style={{ width: "100%", marginBottom: 10 }} />
            <button className="btn" style={{ width: "auto" }} type="submit">Publicar</button>
          </form>
        </div>
      )}

      <div className="card">
        <h2>Feed ({feed.length})</h2>
        {feed.length === 0 ? (
          <p className="stat-label">Nenhuma publicação ainda.</p>
        ) : (
          feed.map((p) => (
            <div className="feed-item" key={p.id}>
              <div className="feed-head">
                <span className="feed-avatar">{initials(p.author?.name)}</span>
                <div>
                  <strong>{p.author?.name ?? "Sistema"}</strong>
                  <span className="stat-label"> · {new Date(p.publishedAt).toLocaleString("pt-BR")}</span>
                </div>
                <span className="badge AI" style={{ marginLeft: "auto" }}>{FEED_TYPES[p.type] ?? p.type}</span>
              </div>
              {p.title && <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.title}</div>}
              <div className="feed-body">{p.body}</div>
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}
