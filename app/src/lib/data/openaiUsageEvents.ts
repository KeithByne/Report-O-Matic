import { getServiceSupabase } from "@/lib/supabase/service";

function formatErr(e: { message: string; details?: string | null; hint?: string | null }): string {
  const parts = [e.message, e.details, e.hint].filter((x): x is string => Boolean(x && String(x).trim()));
  return parts.join(" — ") || "Database error.";
}

export async function logOpenAiUsageEvent(opts: {
  tenantId: string;
  reportId: string | null;
  actorEmail: string | null;
  kind: "draft" | "translate";
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estCostUsd: number;
}): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) return;
  const { error } = await supabase.from("openai_usage_events").insert({
    tenant_id: opts.tenantId,
    report_id: opts.reportId,
    actor_email: opts.actorEmail ? opts.actorEmail.trim().toLowerCase() : null,
    kind: opts.kind,
    model: opts.model,
    prompt_tokens: Math.max(0, Math.trunc(opts.promptTokens || 0)),
    completion_tokens: Math.max(0, Math.trunc(opts.completionTokens || 0)),
    total_tokens: Math.max(0, Math.trunc(opts.totalTokens || 0)),
    est_cost_usd: Number.isFinite(opts.estCostUsd) ? opts.estCostUsd : 0,
  });
  if (error) throw new Error(formatErr(error));
}

