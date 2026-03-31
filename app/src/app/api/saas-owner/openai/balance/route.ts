import { NextResponse } from "next/server";
import { requireSaasOwner } from "@/lib/auth/saasOwner";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requireSaasOwner();
  if (!gate.ok) return gate.res;

  return NextResponse.json(
    {
      ok: false,
      status: 501,
      error: "OpenAI credit balance is not available via API secret keys.",
      detail:
        "OpenAI blocks credit grant/balance endpoints for secret keys (requires a browser session key). Use usage-based spend tracking in this dashboard instead, and check the OpenAI billing UI for the live balance.",
      billing_ui: "https://platform.openai.com/settings/organization/billing/overview",
    },
    { status: 501 },
  );
}

