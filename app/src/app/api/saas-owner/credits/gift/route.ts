import { NextResponse } from "next/server";
import { requireSaasOwner } from "@/lib/auth/saasOwner";
import { giftCreditsToTenant } from "@/lib/data/credits";

type GiftBody = {
  tenant_id?: string;
  credits?: number;
};

export async function POST(req: Request) {
  const gate = await requireSaasOwner();
  if (!gate.ok) return gate.res;

  const body = (await req.json().catch(() => ({}))) as GiftBody;
  const tenantId = typeof body.tenant_id === "string" ? body.tenant_id.trim() : "";
  const credits = Math.trunc(Number(body.credits));
  if (!tenantId) return NextResponse.json({ error: "tenant_id is required." }, { status: 400 });
  if (!Number.isFinite(credits) || credits <= 0) {
    return NextResponse.json({ error: "credits must be a positive whole number." }, { status: 400 });
  }

  try {
    await giftCreditsToTenant({ tenantId, credits, grantedByEmail: gate.email });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to gift credits.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
