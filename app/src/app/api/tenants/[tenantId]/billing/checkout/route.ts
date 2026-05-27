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
import { isCardPaymentsEnabled } from "@/lib/payments/enabled";
import { getPaddle } from "@/lib/paddle/server";
import { resolvePaddlePriceId } from "@/lib/paddle/resolvePriceId";
import { getServiceSupabase } from "@/lib/supabase/service";

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
    .select("referral_code, is_test_access, test_credits_remaining")
    .eq("id", tenantId)
    .maybeSingle();
  const isTest = !!(tenantRow as { is_test_access?: boolean })?.is_test_access;
  const testRemaining = Number((tenantRow as { test_credits_remaining?: number })?.test_credits_remaining ?? 0);
  if (isTest && testRemaining > 0) {
    return NextResponse.json(
      { error: "Use your free test credits first. Purchasing unlocks after the trial reports are used." },
      { status: 403 },
    );
  }

  if (!isCardPaymentsEnabled()) {
    return NextResponse.json(
      {
        error: "Online card payments are temporarily unavailable. The operator will enable them again soon.",
        code: "payments_disabled",
      },
      { status: 503 },
    );
  }

  const paddle = getPaddle();
  if (!paddle) {
    return NextResponse.json(
      {
        error: "Payment integration is not fully configured (missing PADDLE_API_KEY or ROM_PADDLE_ENABLED).",
        code: "paddle_not_configured",
      },
      { status: 503 },
    );
  }

  const { data: pack, error: pErr } = await supabase
    .from("credit_packs")
    .select("id, name, price_cents, currency, report_credits, active, paddle_price_id")
    .eq("id", packId)
    .maybeSingle();
  if (pErr || !pack || !(pack as { active: boolean }).active) {
    return NextResponse.json({ error: "Pack not found." }, { status: 404 });
  }

  const referralCode = (tenantRow as { referral_code?: string })?.referral_code
    ? String((tenantRow as { referral_code?: string }).referral_code)
    : "";

  const baseUrl = process.env.ROM_PUBLIC_BASE_URL?.trim() || new URL(req.url).origin;

  const rate = getSalesTaxRatePercent();
  const packBasis = getPackPriceTaxBasis();
  const taxLabel = getSalesTaxLabelForCustomers();
  const storedCents = Number((pack as { price_cents: number }).price_cents);
  const chargeCents = packGrossChargeCents(Number.isFinite(storedCents) ? storedCents : 0, rate, packBasis);
  const currency = String((pack as { currency: string }).currency || "gbp").toUpperCase();
  const packName = String((pack as { name: string }).name);
  const productName = rate > 0 ? `${packName} (${taxLabel} handled at checkout)` : packName;

  const paddlePriceId = resolvePaddlePriceId(
    packId,
    (pack as { paddle_price_id?: string | null }).paddle_price_id,
  );

  const customData = {
    tenant_id: tenantId,
    pack_id: packId,
    referral_code: referralCode || "",
    buyer_email: session.email,
  };

  const items = paddlePriceId
    ? [{ quantity: 1, priceId: paddlePriceId }]
    : [
        {
          quantity: 1,
          price: {
            description: productName,
            unitPrice: {
              amount: String(chargeCents),
              currencyCode: currency,
            },
            product: {
              name: "Report-O-Matic report credits",
              taxCategory: "standard" as const,
            },
          },
        },
      ];

  try {
    const transaction = await paddle.transactions.create({
      items,
      customData,
      currencyCode: currency,
      collectionMode: "automatic",
    });

    const checkoutUrl =
      transaction.checkout?.url ??
      (transaction.id
        ? `${baseUrl.replace(/\/$/, "")}/?_ptxn=${encodeURIComponent(transaction.id)}`
        : null);

    if (!checkoutUrl) {
      return NextResponse.json({ error: "Paddle did not return a checkout URL." }, { status: 502 });
    }

    return NextResponse.redirect(checkoutUrl, { status: 303 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Paddle checkout failed.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
