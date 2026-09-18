import { NextResponse } from "next/server";
import { requireSaasOwner } from "@/lib/auth/saasOwner";
import { seedInhabitedDemoSchool } from "@/lib/demo/seedInhabitedDemoSchool";
import { getServiceSupabase } from "@/lib/supabase/service";

export async function POST(req: Request) {
  const gate = await requireSaasOwner();
  if (!gate.ok) return gate.res;

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });

  let ownerEmail = gate.email;
  try {
    const body = (await req.json().catch(() => ({}))) as { owner_email?: unknown };
    const override = typeof body.owner_email === "string" ? body.owner_email.trim().toLowerCase() : "";
    if (override) ownerEmail = override;
  } catch {
    // ignore body parse issues — default to SaaS owner email
  }

  const baseUrl = process.env.ROM_PUBLIC_BASE_URL?.trim() || new URL(req.url).origin;

  try {
    const result = await seedInhabitedDemoSchool(supabase, {
      ownerEmail,
      publicBaseUrl: baseUrl,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not seed demo school.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
