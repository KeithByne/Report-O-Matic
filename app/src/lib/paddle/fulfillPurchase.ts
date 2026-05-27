import { creditOwnerForPurchase } from "@/lib/data/credits";
import { getOwnerEmailForTenant } from "@/lib/data/memberships";
import { getServiceSupabase } from "@/lib/supabase/service";

export type PaddlePurchaseCustomData = {
  tenant_id?: string;
  pack_id?: string;
  referral_code?: string;
  buyer_email?: string;
};

function asInt(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function readCustomData(raw: unknown): PaddlePurchaseCustomData {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    tenant_id: typeof o.tenant_id === "string" ? o.tenant_id.trim() : undefined,
    pack_id: typeof o.pack_id === "string" ? o.pack_id.trim() : undefined,
    referral_code: typeof o.referral_code === "string" ? o.referral_code.trim() : undefined,
    buyer_email: typeof o.buyer_email === "string" ? o.buyer_email.trim().toLowerCase() : undefined,
  };
}

/**
 * Apply credits and referral bookkeeping after Paddle reports a completed transaction.
 * `paymentEventId` is stored in `owner_credit_ledger.stripe_event_id` (legacy column name).
 */
export async function fulfillCreditPackPurchase(opts: {
  paymentEventId: string;
  amountCents: number;
  currency: string;
  customerEmail?: string | null;
  customData: unknown;
  completedAtIso: string;
}): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");

  const meta = readCustomData(opts.customData);
  const tenantId = meta.tenant_id ?? "";
  const packId = meta.pack_id ?? "";
  const referralCode = meta.referral_code ?? "";
  const buyerEmail = meta.buyer_email ?? opts.customerEmail?.trim().toLowerCase() ?? "";

  const amount = Math.max(0, asInt(opts.amountCents));
  const currency = String(opts.currency || "gbp").toLowerCase();
  const created = opts.completedAtIso;

  const { error: payErr } = await supabase.from("platform_payments").insert({
    stripe_event_id: opts.paymentEventId,
    stripe_payment_intent_id: opts.paymentEventId,
    stripe_charge_id: null,
    amount_cents: amount,
    currency,
    customer_email: opts.customerEmail || buyerEmail || null,
    description: packId ? `Paddle pack ${packId}` : "Paddle credit pack",
    created_at: created,
  });
  if (payErr && payErr.code !== "23505") throw new Error(payErr.message);

  if (!tenantId || !packId) return;

  const { data: pack, error: pErr } = await supabase
    .from("credit_packs")
    .select("report_credits")
    .eq("id", packId)
    .maybeSingle();
  if (pErr || !pack) return;

  let ownerEmail = buyerEmail;
  if (!ownerEmail) {
    ownerEmail = (await getOwnerEmailForTenant(tenantId)) ?? "";
  }
  if (!ownerEmail) return;

  await creditOwnerForPurchase({
    ownerEmail,
    credits: Number((pack as { report_credits: number }).report_credits) || 0,
    stripeEventId: opts.paymentEventId,
    sourceTenantId: tenantId,
  });

  await supabase.from("tenant_billing").upsert(
    {
      tenant_id: tenantId,
      status: "active",
      stripe_customer_id: null,
      updated_at: new Date().toISOString(),
      active_since: created,
    },
    { onConflict: "tenant_id" },
  );

  await supabase
    .from("tenants")
    .update({ is_test_access: false, test_credits_remaining: null, test_closed_at: null })
    .eq("id", tenantId)
    .eq("is_test_access", true);

  if (referralCode) {
    const { data: agent } = await supabase
      .from("agent_links")
      .select("code, agent_email, commission_bps, payout_wait_days, active")
      .eq("code", referralCode)
      .maybeSingle();
    if (agent && (agent as { active: boolean }).active) {
      const bps = Number((agent as { commission_bps: number }).commission_bps) || 0;
      const commission = Math.max(0, Math.floor((amount * bps) / 10_000));
      const waitDaysRaw = Number((agent as { payout_wait_days: number }).payout_wait_days);
      const waitDays = Number.isFinite(waitDaysRaw) ? Math.max(0, Math.min(3650, Math.trunc(waitDaysRaw))) : 21;
      const eligibleAt = new Date(new Date(created).getTime() + waitDays * 24 * 60 * 60 * 1000).toISOString();
      const { error: rErr } = await supabase.from("referral_earnings").insert({
        agent_code: (agent as { code: string }).code,
        agent_email: (agent as { agent_email: string }).agent_email,
        tenant_id: tenantId,
        stripe_event_id: opts.paymentEventId,
        amount_cents: amount,
        currency,
        commission_cents: commission,
        eligible_at: eligibleAt,
        status: "pending",
      });
      if (rErr && rErr.code !== "23505") throw new Error(rErr.message);
    }
  }
}

function moneyStringToCents(raw: string): number {
  const t = raw.trim();
  if (!t) return 0;
  const n = Number(t);
  if (!Number.isFinite(n)) return 0;
  if (t.includes(".")) return Math.max(0, Math.round(n * 100));
  return Math.max(0, Math.trunc(n));
}

export function totalCentsFromTransaction(data: unknown): number {
  if (!data || typeof data !== "object") return 0;
  const record = data as Record<string, unknown>;
  const details = record.details as { totals?: { total?: string } } | undefined;
  const totalStr = details?.totals?.total;
  if (typeof totalStr === "string") return moneyStringToCents(totalStr);
  return 0;
}
