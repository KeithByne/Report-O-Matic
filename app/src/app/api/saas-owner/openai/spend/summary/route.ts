import { NextResponse } from "next/server";
import { requireSaasOwner } from "@/lib/auth/saasOwner";
import { getServiceSupabase } from "@/lib/supabase/service";
import { rangeToUtcBounds, type FinanceRange } from "@/lib/finance/ranges";

function isRange(s: string): s is FinanceRange {
  return s === "day" || s === "week" || s === "month" || s === "year" || s === "ytd" || s === "all";
}

export async function GET(req: Request) {
  const gate = await requireSaasOwner();
  if (!gate.ok) return gate.res;

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });

  const url = new URL(req.url);
  const rangeRaw = (url.searchParams.get("range") ?? "month").trim().toLowerCase();
  const range: FinanceRange = isRange(rangeRaw) ? rangeRaw : "month";

  const { from, to } = rangeToUtcBounds(range);
  const fromIso = from ? from.toISOString() : null;
  const toIso = to.toISOString();

  try {
    const { data, error } = await supabase
      .from("openai_usage_events")
      .select("model, kind, prompt_tokens, completion_tokens, total_tokens, est_cost_usd, created_at")
      .gte("created_at", fromIso ?? "1970-01-01T00:00:00.000Z")
      .lte("created_at", toIso);
    if (error) throw new Error(error.message);

    const rows =
      (data ?? []) as {
        model: string;
        kind: "draft" | "translate";
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
        est_cost_usd: number;
      }[];

    const totals = {
      requests: rows.length,
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      est_cost_usd: 0,
      by_kind: {
        draft: { requests: 0, total_tokens: 0, est_cost_usd: 0 },
        translate: { requests: 0, total_tokens: 0, est_cost_usd: 0 },
      },
      by_model: {} as Record<string, { requests: number; total_tokens: number; est_cost_usd: number }>,
    };

    for (const r of rows) {
      totals.prompt_tokens += r.prompt_tokens ?? 0;
      totals.completion_tokens += r.completion_tokens ?? 0;
      totals.total_tokens += r.total_tokens ?? 0;
      totals.est_cost_usd += Number(r.est_cost_usd ?? 0);

      const k = r.kind === "translate" ? "translate" : "draft";
      totals.by_kind[k].requests += 1;
      totals.by_kind[k].total_tokens += r.total_tokens ?? 0;
      totals.by_kind[k].est_cost_usd += Number(r.est_cost_usd ?? 0);

      const m = (r.model || "unknown").trim() || "unknown";
      if (!totals.by_model[m]) totals.by_model[m] = { requests: 0, total_tokens: 0, est_cost_usd: 0 };
      totals.by_model[m].requests += 1;
      totals.by_model[m].total_tokens += r.total_tokens ?? 0;
      totals.by_model[m].est_cost_usd += Number(r.est_cost_usd ?? 0);
    }

    return NextResponse.json({
      range,
      from: fromIso,
      to: toIso,
      totals,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

