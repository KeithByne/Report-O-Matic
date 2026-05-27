import { EventName } from "@paddle/paddle-node-sdk";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { isCardPaymentsEnabled } from "@/lib/payments/enabled";
import { fulfillCreditPackPurchase, totalCentsFromTransaction } from "@/lib/paddle/fulfillPurchase";
import { getPaddleForWebhook } from "@/lib/paddle/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const paddle = getPaddleForWebhook();
  if (!paddle) {
    return NextResponse.json({ error: "PADDLE_API_KEY not configured." }, { status: 503 });
  }

  const secret = process.env.PADDLE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "PADDLE_WEBHOOK_SECRET not set." }, { status: 503 });
  }

  const sig = (await headers()).get("paddle-signature");
  if (!sig) return NextResponse.json({ error: "Missing paddle-signature." }, { status: 400 });

  const raw = await req.text();

  let event: Awaited<ReturnType<typeof paddle.webhooks.unmarshal>>;
  try {
    event = await paddle.webhooks.unmarshal(raw, secret, sig);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid signature." }, { status: 400 });
  }

  if (!isCardPaymentsEnabled()) {
    return NextResponse.json({
      received: true,
      ignored: true,
      reason: "ROM_PADDLE_ENABLED is not true — event verified but not applied.",
    });
  }

  try {
    if (event.eventType === EventName.TransactionCompleted) {
      const data = event.data as Record<string, unknown>;
      const txnId = typeof data.id === "string" ? data.id : event.eventId;
      const currency =
        typeof data.currency_code === "string" ? data.currency_code.toLowerCase() : "gbp";
      const customer = data.customer as { email?: string } | undefined;
      const email = typeof customer?.email === "string" ? customer.email : null;
      const completedAt =
        typeof data.billed_at === "string"
          ? data.billed_at
          : typeof data.updated_at === "string"
            ? data.updated_at
            : new Date().toISOString();

      await fulfillCreditPackPurchase({
        paymentEventId: txnId,
        amountCents: totalCentsFromTransaction(data),
        currency,
        customerEmail: email,
        customData: data.custom_data,
        completedAtIso: completedAt,
      });
    }

    return NextResponse.json({ received: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Webhook error.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
