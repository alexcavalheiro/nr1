import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureDb } from "@/src/db";
import { surveyHistory, classify, CLASS_LABEL } from "@/src/index";
import { canManage, requireSession } from "../../lib/auth";
import { AppShell } from "../../components/AppShell";

export const dynamic = "force-dynamic";
const COLOR: Record<string, string> = { alto: "var(--red)", atencao: "var(--yellow)", saudavel: "var(--green)", excelente: "var(--blue)" };

export default async function HistoricoPage() {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) redirect("/dashboard");
  const points = await surveyHistory(session.organizationId);

  return (
    <AppShell session={session} active="surveys" title="Comparativo histórico" subtitle="Evolução dos indicadores entre pesquisas" showReport={false}>
      <p style={{ marginBottom: 16 }}><Link href="/surveys" className="btn-ghost btn-sm">← Voltar às pesquisas</Link></p>

      {points.length === 0 ? (
        <div className="card"><p className="stat-label">Ainda não há pesquisas com respostas suficientes para comparar.</p></div>
      ) : (
        <div className="card" style={{ overflowX: "auto" }}>
          <h2 className="section-title" style={{ marginTop: 0 }}>Índice Geral de Saúde Organizacional</h2>
          <table>
            <thead><tr><th>Pesquisa</th><th>Data</th><th>Respostas</th><th>Índice Geral</th><th>eNPS</th></tr></thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/surveys/${p.id}/resultados`}>{p.title}</Link></td>
                  <td className="hint">{new Date(p.createdAt).toLocaleDateString("pt-BR")}</td>
                  <td>{p.responses}</td>
                  <td>{p.general != null ? <span style={{ color: COLOR[classify(p.general)], fontWeight: 700 }}>{p.general} <span className="hint">{CLASS_LABEL[classify(p.general)]}</span></span> : <span className="hint">— (mín. 5)</span>}</td>
                  <td>{p.enps ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint" style={{ marginTop: 10 }}>Evolução: compare o Índice Geral e o eNPS entre as pesquisas ao longo do tempo. Clique numa pesquisa para abrir os resultados completos.</p>
        </div>
      )}
    </AppShell>
  );
}
