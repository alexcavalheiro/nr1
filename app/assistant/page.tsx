import { ensureDb } from "@/src/db";
import { getConversation, hasRealLlm } from "@/src/index";
import { requireSession } from "../lib/auth";
import { AppShell } from "../components/AppShell";
import { IconBot } from "../components/icons";
import { askAction } from "./actions";

export const dynamic = "force-dynamic";

const SUGGESTIONS = [
  "Quais áreas possuem maior risco?",
  "Quais planos estão vencidos?",
  "Quantos alertas estão abertos?",
  "Como está o engajamento?",
  "Quantas denúncias foram registradas?",
];

export default async function AssistantPage() {
  await ensureDb();
  const session = await requireSession();
  const conv = await getConversation(session.organizationId, session.userId);

  return (
    <AppShell session={session} active="assistant" title="Assistente IA" subtitle="Copiloto NR-1 — pergunte sobre riscos, planos, alertas e indicadores" showReport={false}>
      <div className="card">
        <div className="assistant-head">
          <span className="insight-ico" data-tone="ai" style={{ background: "rgba(124,92,255,0.15)" }}><IconBot /></span>
          <div>
            <strong>Copiloto NR-1</strong>
            <div className="stat-label">{hasRealLlm() ? "IA generativa ativa" : "Modo local (respostas baseadas nos seus dados)"}</div>
          </div>
          <span className={`badge AI`} style={{ marginLeft: "auto" }}>{hasRealLlm() ? "LLM" : "Local"}</span>
        </div>

        <div className="chat">
          {conv.messages.length === 0 && (
            <div className="msg assistant">Olá! Sou o Copiloto NR-1. Pergunte sobre os riscos, planos de ação, alertas e indicadores da sua organização.</div>
          )}
          {conv.messages.map((m) => (
            <div key={m.id} className={`msg ${m.role === "USER" ? "user" : "assistant"}`}>{m.content}</div>
          ))}
        </div>

        <div className="chat-suggest">
          {SUGGESTIONS.map((s) => (
            <form key={s} action={askAction}>
              <input type="hidden" name="text" value={s} />
              <button className="chip" type="submit">{s}</button>
            </form>
          ))}
        </div>

        <form action={askAction} className="chat-input">
          <input name="text" placeholder="Faça uma pergunta…" autoComplete="off" required style={{ flex: 1 }} />
          <button className="btn" type="submit">Enviar</button>
        </form>
      </div>
    </AppShell>
  );
}
