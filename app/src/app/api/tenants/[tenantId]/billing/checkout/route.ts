import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth/session";
import { getRoleForTenant } from "@/lib/data/memberships";
import {
  getPackPriceTaxBasis,
  getSalesTaxLabelForCustomers,
  getSalesTaxRatePercent,
  packGrossChargeCents,
} from "@/lib/finance/salesTax";
import { getServiceSupabase } from "@/lib/supabase/service";
import { isStripePaymentsEnabled } from "@/lib/stripe/enabled";
import { getStripe } from "@/lib/stripe/server";

export const runtime = "nodejs";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function POST(req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });

  const token = (await cookies()).get("rom_session")?.value || "";
  const session = token ? verifySession(token) : null;
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const role = await getRoleForTenant(session.email, tenantId);
  if (role !== "owner") return NextResponse.json({ error: "Only owners can purchase credits." }, { status: 403 });

  const form = await req.formData();
  const packId = String(form.get("pack_id") ?? "").trim();
  if (!packId) return NextResponse.json({ error: "pack_id is required." }, { status: 400 });

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });

  const { data: tenantRow } = await supabase
    .from("tenants")
    .select("referral_code, referred_by_email, is_test_access, test_credits_remaining")
    .eq("id", tenantId)
    .maybeSingle();
  const isTest = !!(tenantRow as any)?.is_test_access;
  const testRemaining = Number((tenantRow as any)?.test_credits_remaining ?? 0);
  if (isTest && testRemaining > 0) {
    return NextResponse.json(
      { error: "Use your free test credits first. Purchasing unlocks after the trial reports are used." },
      { status: 403 },
    );
  }

  if (!isStripePaymentsEnabled()) {
    return NextResponse.json(
      {
        error: "Online card payments are temporarily unavailable. The operator will enable them again soon.",
        code: "payments_disabled",
      },
      { status: 503 },
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Payment integration is not fully configured (missing STRIPE_SECRET_KEY or ROM_STRIPE_ENABLED).", code: "stripe_not_configured" },
      { status: 503 },
    );
  }

  const { data: pack, error: pErr } = await supabase
    .from("credit_packs")
    .select("id, name, price_cents, currency, report_credits, active")
    .eq("id", packId)
    .maybeSingle();
  if (pErr || !pack || !(pack as any).active) return NextResponse.json({ error: "Pack not found." }, { status: 404 });

  const referralCode = (tenantRow as any)?.referral_code ? String((tenantRow as any).referral_code) : "";

  const baseUrl = process.env.ROM_PUBLIC_BASE_URL?.trim() || new URL(req.url).origin;
  const successUrl = `${baseUrl}/reports/${encodeURIComponent(tenantId)}/billing/success`;
  const cancelUrl = `${baseUrl}/reports/${encodeURIComponent(tenantId)}/billing`;

  const rate = getSalesTaxRatePercent();
  const packBasis = getPackPriceTaxBasis();
  const taxLabel = getSalesTaxLabelForCustomers();
  const storedCents = Number((pack as any).price_cents);
  const unitAmount = packGrossChargeCents(Number.isFinite(storedCents) ? storedCents : 0, rate, packBasis);
  const packName = String((pack as any).name);
  const productName = rate > 0 ? `${packName} (${taxLabel} incl.)` : packName;

  const sess = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: session.email,
    line_items: [
      {
        price_data: {
          currency: String((pack as any).currency || "eur"),
          product_data: { name: productName },
          unit_amount: unitAmount,
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      tenant_id: tenantId,
      pack_id: packId,
      referral_code: referralCode || "",
      buyer_email: session.email,
    },
    payment_intent_data: {
      metadata: {
        tenant_id: tenantId,
        pack_id: packId,
        referral_code: referralCode || "",
        buyer_email: session.email,
      },
    },
  });

  return NextResponse.redirect(sess.url!, { status: 303 });
}

