import { NextResponse } from "next/server";
import { requireSaasOwner } from "@/lib/auth/saasOwner";
import { getServiceSupabase } from "@/lib/supabase/service";

function normEmail(s: string): string {
  return s.trim().toLowerCase();
}

function newCode(): string {
  // Short, URL-friendly.
  return Math.random().toString(36).slice(2, 10);
}

export async function GET() {
  const gate = await requireSaasOwner();
  if (!gate.ok) return gate.res;
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  const { data, error } = await supabase
    .from("agent_links")
    .select(
      "code, agent_email, display_name, active, commission_bps, payout_wait_days, inactive_after_days, last_active_at, created_at",
    )
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ agents: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireSaasOwner();
  if (!gate.ok) return gate.res;
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });

  let body: any = {};
  try {
    body = (await req.json()) as any;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const email = typeof body.agent_email === "string" ? normEmail(body.agent_email) : "";
  if (!email || !email.includes("@")) return NextResponse.json({ error: "agent_email is required." }, { status: 400 });

  const display = typeof body.display_name === "string" ? body.display_name.trim() : null;
  const commissionBps = typeof body.commission_bps === "number" ? Math.trunc(body.commission_bps) : 2000; // default 20%
  const inactiveAfterDays =
    typeof body.inactive_after_days === "number" ? Math.trunc(body.inactive_after_days) : 400;

  // generate unique code (retry a few times)
  let code = "";
  for (let i = 0; i < 6; i++) {
    code = newCode();
    const { error } = await supabase.from("agent_links").insert({
      code,
      agent_email: email,
      display_name: display,
      active: true,
      commission_bps: Math.max(0, Math.min(10000, commissionBps)),
      payout_wait_days: 21,
      inactive_after_days: Math.max(1, Math.min(5000, inactiveAfterDays)),
    });
    if (!error) break;
    if ((error as any).code !== "23505") return NextResponse.json({ error: error.message }, { status: 500 });
    code = "";
  }
  if (!code) return NextResponse.json({ error: "Could not create agent code. Try again." }, { status: 500 });
  return NextResponse.json({ ok: true, code });
}

export async function PATCH(req: Request) {
  const gate = await requireSaasOwner();
  if (!gate.ok) return gate.res;
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });

  let body: any = {};
  try {
    body = (await req.json()) as any;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) return NextResponse.json({ error: "code is required." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.display_name === "string") patch.display_name = body.display_name.trim() || null;
  if (typeof body.active === "boolean") patch.active = body.active;
  if (typeof body.commission_bps === "number")
    patch.commission_bps = Math.max(0, Math.min(10000, Math.trunc(body.commission_bps)));
  if (typeof body.payout_wait_days === "number")
    patch.payout_wait_days = Math.max(0, Math.min(3650, Math.trunc(body.payout_wait_days)));
  if (typeof body.inactive_after_days === "number")
    patch.inactive_after_days = Math.max(1, Math.min(5000, Math.trunc(body.inactive_after_days)));

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "No changes." }, { status: 400 });

  const { data, error } = await supabase
    .from("agent_links")
    .update(patch)
    .eq("code", code)
    .select(
      "code, agent_email, display_name, active, commission_bps, payout_wait_days, inactive_after_days, last_active_at, created_at",
    )
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ agent: data });
}

