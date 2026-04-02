import { NextResponse } from "next/server";
import { requireSaasOwner } from "@/lib/auth/saasOwner";
import { rangeToUtcBounds, type FinanceRange } from "@/lib/finance/ranges";
import { parseVatEstimateEnv, vatOnPaymentsCents } from "@/lib/finance/vatEstimate";
import { getServiceSupabase } from "@/lib/supabase/service";
import type { SupabaseClient } from "@supabase/supabase-js";

function isRange(s: string): s is FinanceRange {
  return s === "day" || s === "week" || s === "month" || s === "year" || s === "ytd" || s === "all";
}

async function sumPlatformPaymentsCents(
  supabase: SupabaseClient,
  fromIso: string | null,
  toIso: string,
): Promise<number> {
  let q = supabase.from("platform_payments").select("amount_cents");
  if (fromIso) q = q.gte("created_at", fromIso);
  q = q.lte("created_at", toIso);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).reduce((sum, r: { amount_cents: number }) => sum + (r.amount_cents ?? 0), 0);
}

export async function GET(req: Request) {
  const gate = await requireSaasOwner();
  if (!gate.ok) return gate.res;

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });

  const url = new URL(req.url);
  const rangeRaw = (url.searchParams.get("range") ?? "month").trim().toLowerCase();
  const range: FinanceRange = isRange(rangeRaw) ? rangeRaw : "month";
  const agent = (url.searchParams.get("agent") ?? "").trim().toLowerCase();

  const { from, to } = rangeToUtcBounds(range);
  const fromIso = from ? from.toISOString() : null;
  const toIso = to.toISOString();

  try {
    let paymentsQ = supabase
      .from("platform_payments")
      .select("amount_cents", { count: "exact", head: false })
      .gte("created_at", fromIso ?? "1970-01-01T00:00:00.000Z")
      .lte("created_at", toIso);

    // payouts (optionally filtered by agent)
    let payoutsQ = supabase
      .from("agent_payouts")
      .select("amount_cents, agent_account", { count: "exact", head: false })
      .gte("created_at", fromIso ?? "1970-01-01T00:00:00.000Z")
      .lte("created_at", toIso);

    if (agent) payoutsQ = payoutsQ.ilike("agent_account", agent);

    const [{ data: payRows, error: pErr, count: payCount }, { data: outRows, error: oErr, count: outCount }] =
      await Promise.all([paymentsQ, payoutsQ]);
    if (pErr) throw new Error(pErr.message);
    if (oErr) throw new Error(oErr.message);

    const paidCents = (payRows ?? []).reduce((sum, r: { amount_cents: number }) => sum + (r.amount_cents ?? 0), 0);
    const payoutCents = (outRows ?? []).reduce((sum, r: { amount_cents: number }) => sum + (r.amount_cents ?? 0), 0);

    const vatCfg = parseVatEstimateEnv();
    const now = new Date();
    const ytdBounds = rangeToUtcBounds("ytd", now);
    const allBounds = rangeToUtcBounds("all", now);
    const ytdFromIso = ytdBounds.from ? ytdBounds.from.toISOString() : null;
    const ytdToIso = ytdBounds.to.toISOString();
    const allToIso = allBounds.to.toISOString();

    let vat_estimate: Record<string, unknown> | null = null;
    if (vatCfg.enabled) {
      const [ytdPaymentsCents, allTimePaymentsCents] = await Promise.all([
        sumPlatformPaymentsCents(supabase, ytdFromIso, ytdToIso),
        sumPlatformPaymentsCents(supabase, null, allToIso),
      ]);
      const selectedPaymentsCents = paidCents;
      vat_estimate = {
        rate_percent: vatCfg.ratePercent,
        basis: vatCfg.basis,
        display_currency: vatCfg.displayCurrency,
        on_payments_in: {
          selected_period_cents: vatOnPaymentsCents(selectedPaymentsCents, vatCfg.ratePercent, vatCfg.basis),
          ytd_cents: vatOnPaymentsCents(ytdPaymentsCents, vatCfg.ratePercent, vatCfg.basis),
          all_time_cents: vatOnPaymentsCents(allTimePaymentsCents, vatCfg.ratePercent, vatCfg.basis),
        },
        revenue_payments_in_cents: {
          selected_period: selectedPaymentsCents,
          ytd: ytdPaymentsCents,
          all_time: allTimePaymentsCents,
        },
      };
    }

    return NextResponse.json({
      range,
      from: fromIso,
      to: toIso,
      payments_in: { count: payCount ?? (payRows ?? []).length, amount_cents: paidCents },
      agent_payouts_out: { count: outCount ?? (outRows ?? []).length, amount_cents: payoutCents },
      ...(agent ? { agent } : {}),
      ...(vat_estimate ? { vat_estimate } : {}),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

