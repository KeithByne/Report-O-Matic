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

    return NextResponse.json({
      range,
      from: fromIso,
      to: toIso,
      payments_in: { count: payCount ?? (payRows ?? []).length, amount_cents: paidCents },
      agent_payouts_out: { count: outCount ?? (outRows ?? []).length, amount_cents: payoutCents },
      ...(agent ? { agent } : {}),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

