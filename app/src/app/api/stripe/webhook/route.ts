import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getServiceSupabase } from "@/lib/supabase/service";
import { getStripe } from "@/lib/stripe/server";
import { creditTenantForPurchase } from "@/lib/data/credits";

export const runtime = "nodejs";

function asInt(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Stripe not configured." }, { status: 503 });
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET not set." }, { status: 503 });

  const sig = (await headers()).get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing stripe-signature." }, { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid signature." }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });

  try {
    // Payments IN
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
      const amount = asInt(pi.amount_received ?? pi.amount ?? 0);
      const currency = String(pi.currency || "").toLowerCase() || "usd";
      const created = new Date((pi.created ?? event.created) * 1000).toISOString();
      const email =
        (typeof pi.receipt_email === "string" ? pi.receipt_email : "") ||
        (typeof (pi.metadata?.customer_email) === "string" ? pi.metadata.customer_email : "") ||
        "";
      const desc = typeof pi.description === "string" ? pi.description : "";
      const tenantId = typeof pi.metadata?.tenant_id === "string" ? pi.metadata.tenant_id.trim() : "";
      const packId = typeof pi.metadata?.pack_id === "string" ? pi.metadata.pack_id.trim() : "";
      const referralCode = typeof pi.metadata?.referral_code === "string" ? pi.metadata.referral_code.trim() : "";

      // Optional: if you later attach tenant/agent IDs in metadata, we can store them too.
      const { error } = await supabase.from("platform_payments").insert({
        stripe_event_id: event.id,
        stripe_payment_intent_id: pi.id,
        stripe_charge_id: typeof pi.latest_charge === "string" ? pi.latest_charge : null,
        amount_cents: amount,
        currency,
        customer_email: email || null,
        description: desc || null,
        created_at: created,
      });
      if (error && error.code !== "23505") throw new Error(error.message);

      // Credit tenant if this payment came from a pack checkout.
      if (tenantId && packId) {
        const { data: pack, error: pErr } = await supabase
          .from("credit_packs")
          .select("report_credits, currency, price_cents")
          .eq("id", packId)
          .maybeSingle();
        if (!pErr && pack) {
          await creditTenantForPurchase({
            tenantId,
            credits: Number((pack as any).report_credits) || 0,
            stripeEventId: event.id,
          });
          await supabase.from("tenant_billing").upsert(
            {
              tenant_id: tenantId,
              status: "active",
              stripe_customer_id: typeof pi.customer === "string" ? pi.customer : null,
              updated_at: new Date().toISOString(),
              active_since: created,
            },
            { onConflict: "tenant_id" },
          );

          // Referral earning (default 20% commission if agent link exists and active).
          if (referralCode) {
            const { data: agent } = await supabase
              .from("agent_links")
              .select("code, agent_email, commission_bps, payout_wait_days, active")
              .eq("code", referralCode)
              .maybeSingle();
            if (agent && (agent as any).active) {
              const bps = Number((agent as any).commission_bps) || 0;
              const commission = Math.max(0, Math.floor((amount * bps) / 10_000));
              const waitDaysRaw = Number((agent as any).payout_wait_days);
              const waitDays = Number.isFinite(waitDaysRaw) ? Math.max(0, Math.min(3650, Math.trunc(waitDaysRaw))) : 21;
              const eligibleAt = new Date(new Date(created).getTime() + waitDays * 24 * 60 * 60 * 1000).toISOString();
              const { error: rErr } = await supabase.from("referral_earnings").insert({
                agent_code: (agent as any).code,
                agent_email: (agent as any).agent_email,
                tenant_id: tenantId,
                stripe_event_id: event.id,
                amount_cents: amount,
                currency,
                commission_cents: commission,
                eligible_at: eligibleAt,
                status: "pending",
              });
              if (rErr && (rErr as any).code !== "23505") throw new Error((rErr as any).message);
            }
          }
        }
      }
    }

    // Payouts OUT to agents (record transfers)
    if (event.type === "transfer.created") {
      const tr = event.data.object as Stripe.Transfer;
      const amount = asInt(tr.amount ?? 0);
      const currency = String(tr.currency || "").toLowerCase() || "usd";
      const created = new Date((tr.created ?? event.created) * 1000).toISOString();
      const memo = typeof tr.description === "string" ? tr.description : "";
      const agentAccount =
        (typeof (tr.metadata?.agent_account) === "string" ? tr.metadata.agent_account : "").trim() ||
        "unknown";

      const { error } = await supabase.from("agent_payouts").insert({
        stripe_event_id: event.id,
        stripe_transfer_id: tr.id,
        stripe_payout_id: null,
        amount_cents: amount,
        currency,
        agent_account: agentAccount,
        memo: memo || null,
        created_at: created,
      });
      if (error && error.code !== "23505") throw new Error(error.message);
    }

    return NextResponse.json({ received: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Webhook error.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

