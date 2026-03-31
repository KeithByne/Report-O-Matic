import { NextResponse } from "next/server";
import { requireSaasOwner } from "@/lib/auth/saasOwner";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requireSaasOwner();
  if (!gate.ok) return gate.res;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY not set." }, { status: 503 });

  // Best available: the legacy billing dashboard endpoint for credit grants.
  // Not guaranteed long-term; if it fails we return a clear error.
  try {
    const res = await fetch("https://api.openai.com/dashboard/billing/credit_grants", {
      headers: { authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          status: res.status,
          error: "OpenAI balance endpoint returned an error.",
          detail: text.slice(0, 500),
        },
        { status: 502 },
      );
    }
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    return NextResponse.json({ ok: true, source: "credit_grants", data: json });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

