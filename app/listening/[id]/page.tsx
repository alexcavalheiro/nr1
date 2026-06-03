import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ensureDb, prisma } from "@/src/db";
import { getManifestationDetail } from "@/src/index";
import { canManage, requireSession } from "../../lib/auth";
import { AppShell } from "../../components/AppShell";
import { MANIF_STATUS, MANIF_TYPES } from "../page";
import { assignToMeAction, createRiskFromManifestationAction, updateStatusAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ManifestationDetail({ params }: { params: Promise<{ id: string }> }) {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) redirect("/listening");
  const { id } = await params;
  const m = await getManifestationDetail(session.organizationId, id);
  if (!m) notFound();
  const categories = await prisma.riskCategory.findMany({ orderBy: { name: "asc" } });

  return (
    <AppShell session={session} active="listening" title={`${MANIF_TYPES[m.type] ?? m.type}${m.subject ? `: ${m.subject}` : ""}`} subtitle="Tratativa da manifestação">
        <Link href="/listening" className="nav-link">← Voltar à escuta</Link>
        <p className="muted">
          {m.anonymous ? "Anônimo" : m.author?.name ?? "—"} · {MANIF_STATUS[m.status] ?? m.status}
          {m.handler ? ` · responsável: ${m.handler.name}` : ""}
        </p>

        <div className="card" style={{ marginBottom: 16 }}>
          <h2>Conteúdo</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{m.body}</p>
        </div>

        <div className="grid-2">
          <div className="card">
            <h2>Tratativa</h2>
            <form action={updateStatusAction} className="form-row" style={{ marginBottom: 12 }}>
              <input type="hidden" name="id" value={m.id} />
              <select name="status" defaultValue={m.status}>
                {Object.entries(MANIF_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <button className="btn" style={{ width: "auto" }} type="submit">Atualizar status</button>
            </form>
            <form action={assignToMeAction}>
              <input type="hidden" name="id" value={m.id} />
              <button className="btn btn-ghost" type="submit">Assumir como responsável</button>
            </form>
          </div>

          <div className="card">
            <h2>Originar risco no inventário</h2>
            <p className="stat-label">Cria um risco rastreável a partir desta manifestação.</p>
            <form action={createRiskFromManifestationAction} className="form-row">
              <input type="hidden" name="id" value={m.id} />
              <select name="categoryId" required style={{ flex: 1 }}>
                <option value="">Categoria de risco…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button className="btn" style={{ width: "auto" }} type="submit">Gerar risco</button>
            </form>
            {m.riskSources.length > 0 && (
              <ul className="insights" style={{ marginTop: 12 }}>
                {m.riskSources.map((s) => (
                  <li key={s.id}>Risco gerado: <Link href={`/risks/${s.risk?.id}`}>{s.risk?.title}</Link></li>
                ))}
              </ul>
            )}
          </div>
        </div>
    </AppShell>
  );
}
