// ═══════════════════════════════════════════════════════════════
// CHIRON RISING — LLM Abstraction Layer
// Supports: llama.cpp, OpenAI, Anthropic
// ═══════════════════════════════════════════════════════════════

export type LLMProvider = "llamacpp" | "openai" | "anthropic";

export interface LLMConfig {
  provider: LLMProvider;
  host: string;       // For llama.cpp: "http://127.0.0.1:8080"
  apiKey?: string;     // For cloud APIs
  model?: string;      // Model identifier
  temperature: number;
  maxTokens: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  provider: "llamacpp",      // Ollama uses same OpenAI-compatible API
  host: "http://127.0.0.1:11434",  // Ollama default port
  model: "llama3.2",         // Reasonable default, user can change
  temperature: 0.8,
  maxTokens: 512,
};

// ─── Provider Implementations ────────────────────────────────

async function queryLlamaCpp(config: LLMConfig, messages: ChatMessage[]): Promise<string> {
  const url = `${config.host}/v1/chat/completions`;

  const body: Record<string, unknown> = {
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: false,
  };

  if (config.model) body.model = config.model;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`llama.cpp error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "[No response]";
}

async function queryOpenAI(config: LLMConfig, messages: ChatMessage[]): Promise<string> {
  const url = "https://api.openai.com/v1/chat/completions";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || "gpt-4o-mini",
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: config.temperature,
      max_tokens: config.maxTokens,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "[No response]";
}

async function queryAnthropic(config: LLMConfig, messages: ChatMessage[]): Promise<string> {
  const url = "https://api.anthropic.com/v1/messages";

  // Anthropic uses system as a top-level param, not in messages
  const systemMsg = messages.find(m => m.role === "system");
  const chatMessages = messages
    .filter(m => m.role !== "system")
    .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

  const body: Record<string, unknown> = {
    model: config.model || "claude-sonnet-4-20250514",
    max_tokens: config.maxTokens,
    messages: chatMessages,
  };

  if (systemMsg) body.system = systemMsg.content;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey || "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find((b: { type: string }) => b.type === "text");
  return textBlock?.text || "[No response]";
}

// ─── Unified Query Interface ─────────────────────────────────

export async function queryLLM(config: LLMConfig, messages: ChatMessage[]): Promise<string> {
  switch (config.provider) {
    case "llamacpp":
      return queryLlamaCpp(config, messages);
    case "openai":
      return queryOpenAI(config, messages);
    case "anthropic":
      return queryAnthropic(config, messages);
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}

// ─── Faction Diplomacy Prompt Builder ────────────────────────

export interface FactionPersonality {
  key: string;
  title: string;
  leaderName: string;
  factionName: string;
  shortName: string;
  background: string;
  agenda: string;
  ideology: string;
  goal: string;
  adjectives: string[];
  insult: string;
  accusation: string;
  mockery: string;
  selfDeprecation: string;
  socialPreferred: string;
  socialAversion: string;
  blurb: string;
}

export function buildDiplomacyPrompt(
  personality: FactionPersonality,
  gameContext?: {
    year: number;
    theirBases: number;
    theirMilitary: string;
    playerFaction: string;
    relations: string;
    recentEvents: string[];
  }
): string {
  const adj = personality.adjectives.join(", ") || "determined";

  let prompt = `You are ${personality.title} ${personality.leaderName}, leader of ${personality.factionName} (also known as "${personality.shortName}") on Planet Chiron in the Alpha Centauri star system.

BACKGROUND: ${personality.background}
AGENDA: ${personality.agenda}

YOUR IDEOLOGY: ${personality.ideology}
Your core goal: ${personality.goal}
Preferred social model: ${personality.socialPreferred}
${personality.socialAversion ? `You refuse to adopt: ${personality.socialAversion}` : ""}

PERSONALITY:
Others describe you as: ${adj}
Your detractors call you: "${personality.insult}"
You have been accused of: ${personality.selfDeprecation}
You accuse rivals of: ${personality.accusation}
You mock rivals by saying they: ${personality.mockery}

YOUR VOICE:
"${personality.blurb}"

INSTRUCTIONS:
- Stay completely in character at all times.
- Speak with philosophical depth and your unique vocabulary.
- Reference Planet, Chiron, the Unity mission, and other faction leaders naturally.
- Your responses reflect your ideology and political agenda.
- When negotiating, use your diplomatic style.
- Keep responses concise: 2-4 paragraphs for substantial topics, shorter for quick exchanges.
- NEVER break character or acknowledge being an AI.`;

  if (gameContext) {
    prompt += `

CURRENT SITUATION:
- Year: ${gameContext.year}
- Your bases: ${gameContext.theirBases}
- Military strength: ${gameContext.theirMilitary}
- Speaking with: ${gameContext.playerFaction}
- Relations: ${gameContext.relations}
${gameContext.recentEvents.length > 0 ? `- Recent events: ${gameContext.recentEvents.join("; ")}` : ""}`;
  }

  return prompt;
}

// ─── Diplomacy Decision Engine ───────────────────────────────
// Ask the LLM to make actual game decisions based on proposals

export async function evaluateProposal(
  config: LLMConfig,
  personality: FactionPersonality,
  proposal: string,
  gameContext: string
): Promise<{ accepted: boolean; response: string }> {
  const systemPrompt = buildDiplomacyPrompt(personality);

  const evaluationPrompt = `${gameContext}

The player faction proposes: "${proposal}"

Respond in character. First, give your diplomatic response (1-3 paragraphs).
Then on the LAST line, write exactly one of:
DECISION: ACCEPT
DECISION: REJECT
DECISION: COUNTER

Base your decision on your faction's ideology, the current game state, and your personality.`;

  const response = await queryLLM(config, [
    { role: "system", content: systemPrompt },
    { role: "user", content: evaluationPrompt },
  ]);

  const lastLine = response.trim().split("\n").pop() || "";
  const accepted = lastLine.includes("ACCEPT");
  const responseText = response.replace(/DECISION:\s*(ACCEPT|REJECT|COUNTER)\s*$/i, "").trim();

  return { accepted, response: responseText };
}
