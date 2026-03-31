export type OpenAiUsage = {
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

type Pricing = { promptPer1M: number; completionPer1M: number };

// Defaults are intentionally conservative and can be overridden via env.
const DEFAULT_PRICING_USD_PER_1M: Record<string, Pricing> = {
  "gpt-4o-mini": { promptPer1M: 0.15, completionPer1M: 0.60 },
  "gpt-4o": { promptPer1M: 5.0, completionPer1M: 15.0 },
};

function envNum(name: string): number | null {
  const raw = process.env[name];
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function estimateOpenAiCostUsd(usage: OpenAiUsage): number {
  const model = (usage.model || "").trim();
  const base = DEFAULT_PRICING_USD_PER_1M[model];

  const promptPer1M = envNum("ROM_OPENAI_PROMPT_USD_PER_1M") ?? base?.promptPer1M ?? 0;
  const completionPer1M = envNum("ROM_OPENAI_COMPLETION_USD_PER_1M") ?? base?.completionPer1M ?? 0;

  const prompt = Math.max(0, usage.prompt_tokens || 0);
  const completion = Math.max(0, usage.completion_tokens || 0);

  return (prompt / 1_000_000) * promptPer1M + (completion / 1_000_000) * completionPer1M;
}

