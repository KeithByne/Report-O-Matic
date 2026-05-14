import { NextResponse } from "next/server";
import { requireSaasOwner } from "@/lib/auth/saasOwner";
import { allowReaccessForEmail } from "@/lib/data/cancelledUsers";

type Body = { email?: unknown };

function norm(s: string): string {
  return s.trim().toLowerCase();
}

export async function POST(req: Request) {
  const gate = await requireSaasOwner();
  if (!gate.ok) return gate.res;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = norm(typeof body.email === "string" ? body.email : "");
  if (!email || !email.includes("@") || email.length > 320) {
    return NextResponse.json({ error: "Please provide a valid email." }, { status: 400 });
  }

  try {
    await allowReaccessForEmail(email);
    return NextResponse.json({ ok: true, email });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not update.";
    if (msg.includes("No cancelled-user record")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    console.error("[ROM saas-owner cancelled-users/allow]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
