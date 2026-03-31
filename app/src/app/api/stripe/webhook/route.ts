import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getServiceSupabase } from "@/lib/supabase/service";
import { getStripe } from "@/lib/stripe/server";

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

