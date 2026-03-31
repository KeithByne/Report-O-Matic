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

function missingPayoutWaitColumn(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err ?? "");
  return msg.includes("payout_wait_days");
}

function normalizeAgents(rows: unknown[]): unknown[] {
  return rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      ...row,
      payout_wait_days: typeof row.payout_wait_days === "number" ? row.payout_wait_days : 21,
    };
  });
}

export async function GET() {
  const gate = await requireSaasOwner();
  if (!gate.ok) return gate.res;
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  const { data, error } = await supabase.from("agent_links").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ agents: normalizeAgents(data ?? []) });
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
    const row = {
      code,
      agent_email: email,
      display_name: display,
      active: true,
      commission_bps: Math.max(0, Math.min(10000, commissionBps)),
      payout_wait_days: 21,
      inactive_after_days: Math.max(1, Math.min(5000, inactiveAfterDays)),
    };
    let { error } = await supabase.from("agent_links").insert(row);
    if (error && missingPayoutWaitColumn(error)) {
      const { payout_wait_days: _p, ...withoutWait } = row;
      ({ error } = await supabase.from("agent_links").insert(withoutWait));
    }
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

  let { data, error } = await supabase.from("agent_links").update(patch).eq("code", code).select("*").single();
  if (error && missingPayoutWaitColumn(error) && "payout_wait_days" in patch) {
    const { payout_wait_days: _w, ...rest } = patch;
    if (Object.keys(rest).length === 0) {
      return NextResponse.json(
        {
          error:
            "Database is missing column agent_links.payout_wait_days. Run migration supabase/migrations/0020_agent_payout_wait_days.sql, then retry.",
        },
        { status: 503 },
      );
    }
    ({ data, error } = await supabase.from("agent_links").update(rest).eq("code", code).select("*").single());
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const agent = data;
  return NextResponse.json({ agent: normalizeAgents(agent ? [agent] : [])[0] });
}

