import { AiProvider } from "@prisma/client";

// =============================================================================
// Abstração de LLM — desacopla a lógica dos agentes do provedor concreto.
// Default: TemplateLlmClient (determinístico, sem rede) → roda sem chaves.
// Para produção: implementar OpenAi/Claude/Gemini client com a mesma interface.
// =============================================================================

export interface LlmMessage {
  role: "system" | "user";
  content: string;
}

export interface LlmClient {
  readonly provider: AiProvider;
  complete(messages: LlmMessage[]): Promise<string>;
}

/**
 * Cliente determinístico: compõe a resposta a partir do conteúdo recebido.
 * Permite rodar/testar o pipeline de agentes sem custo nem dependência externa.
 */
export class TemplateLlmClient implements LlmClient {
  readonly provider: AiProvider = "CLAUDE";
  async complete(messages: LlmMessage[]): Promise<string> {
    const user = messages.filter((m) => m.role === "user").map((m) => m.content).join("\n\n");
    return user.trim();
  }
}

/** Cliente Claude (Anthropic) via REST — usado quando ANTHROPIC_API_KEY existe. */
export class ClaudeLlmClient implements LlmClient {
  readonly provider: AiProvider = "CLAUDE";
  constructor(
    private apiKey: string,
    private model = process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-latest",
  ) {}

  async complete(messages: LlmMessage[]): Promise<string> {
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const userMessages = messages.filter((m) => m.role === "user").map((m) => ({ role: "user" as const, content: m.content }));
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": this.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: this.model, max_tokens: 1024, system, messages: userMessages }),
    });
    if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { content?: { text?: string }[] };
    return data.content?.[0]?.text ?? "";
  }
}

/**
 * Fábrica do cliente. Usa Claude real se ANTHROPIC_API_KEY estiver definida;
 * caso contrário cai no TemplateLlmClient (determinístico, sem custo/rede).
 */
export function getLlmClient(_provider: AiProvider = "CLAUDE"): LlmClient {
  const key = process.env.ANTHROPIC_API_KEY;
  return key ? new ClaudeLlmClient(key) : new TemplateLlmClient();
}

/** Indica se há um provedor de IA real configurado (para a UI sinalizar). */
export function hasRealLlm(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
