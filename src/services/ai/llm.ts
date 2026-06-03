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
  // Modelo atual mais capaz. Sobreponha com ANTHROPIC_MODEL para usar um mais
  // barato/rápido (ex.: claude-sonnet-4-6, claude-haiku-4-5).
  private readonly model = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";
  private readonly maxTokens = Number(process.env.ANTHROPIC_MAX_TOKENS ?? 2048);
  private readonly timeoutMs = Number(process.env.ANTHROPIC_TIMEOUT_MS ?? 60_000);
  private readonly maxRetries = Number(process.env.ANTHROPIC_MAX_RETRIES ?? 2);

  constructor(private apiKey: string) {}

  async complete(messages: LlmMessage[]): Promise<string> {
    // System como bloco com cache_control: o prefixo estável é reaproveitado
    // entre requisições (prompt caching) quando ele é grande o suficiente.
    const systemText = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const system = systemText
      ? [{ type: "text" as const, text: systemText, cache_control: { type: "ephemeral" as const } }]
      : undefined;
    const userMessages = messages
      .filter((m) => m.role === "user")
      .map((m) => ({ role: "user" as const, content: m.content }));

    const body = JSON.stringify({ model: this.model, max_tokens: this.maxTokens, system, messages: userMessages });
    const data = await this.request(body);
    // Concatena todos os blocos de texto (ignora thinking/tool_use, se houver).
    return (data.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("")
      .trim();
  }

  /** POST com timeout (AbortController) e retry exponencial em 429/5xx/529. */
  private async request(body: string): Promise<{ content?: { type?: string; text?: string }[] }> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": this.apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body,
          signal: controller.signal,
        });
        if (res.ok) return (await res.json()) as { content?: { type?: string; text?: string }[] };

        // 429/500/529 são transitórios → retry com backoff (respeita retry-after).
        if ((res.status === 429 || res.status >= 500) && attempt < this.maxRetries) {
          const retryAfter = Number(res.headers.get("retry-after"));
          await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoffMs(attempt));
          continue;
        }
        throw new Error(`Claude API ${res.status}: ${await res.text()}`);
      } catch (err) {
        lastError = err;
        const aborted = err instanceof Error && err.name === "AbortError";
        // Aborto (timeout) e erros de rede são retentáveis.
        const retryable = aborted || (err instanceof TypeError);
        if (retryable && attempt < this.maxRetries) {
          await sleep(backoffMs(attempt));
          continue;
        }
        if (aborted) throw new Error(`Claude API timeout após ${this.timeoutMs}ms.`);
        throw err;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Claude API: falha desconhecida.");
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Backoff exponencial com jitter: ~1s, 2s, 4s…
const backoffMs = (attempt: number) => 2 ** attempt * 1000 + Math.floor(Math.random() * 250);

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
