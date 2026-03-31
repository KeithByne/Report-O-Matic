import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { getServiceSupabase } from "@/lib/supabase/service";
import { hasOwnerMembership } from "@/lib/data/memberships";

export const runtime = "nodejs";

function normEmail(s: string): string {
  return s.trim().toLowerCase();
}

function newCode(): string {
  return Math.random().toString(36).slice(2, 10);
}

function missingColumn(err: unknown, col: string): boolean {
  const msg = String((err as { message?: string })?.message ?? err ?? "");
  return msg.includes(col);
}

function normalizeAgent(row: any): any {
  const r = row ?? {};
  return {
    ...r,
    payout_wait_days: typeof r.payout_wait_days === "number" ? r.payout_wait_days : 21,
    inactive_after_days: typeof r.inactive_after_days === "number" ? r.inactive_after_days : 400,
    commission_bps: typeof r.commission_bps === "number" ? r.commission_bps : 2000,
    active: typeof r.active === "boolean" ? r.active : true,
  };
}

async function requireOwner(): Promise<{ ok: true; email: string } | { ok: false; res: NextResponse }> {
  const token = (await cookies()).get("rom_session")?.value || "";
  const session = token ? verifySession(token) : null;
  if (!session) return { ok: false, res: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  const email = normEmail(session.email);
  const isOwner = await hasOwnerMembership(email);
  if (!isOwner) return { ok: false, res: NextResponse.json({ error: "Owner access required." }, { status: 403 }) };
  return { ok: true, email };
}

export async function GET() {
  const gate = await requireOwner();
  if (!gate.ok) return gate.res;
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });

  // Find existing agent link for this email.
  const { data: existing, error: eErr } = await supabase
    .from("agent_links")
    .select("*")
    .eq("agent_email", gate.email)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 });
  if (existing) return NextResponse.json({ agent: normalizeAgent(existing) });

  // Create one.
  for (let i = 0; i < 8; i++) {
    const code = newCode();
    const row: any = {
      code,
      agent_email: gate.email,
      display_name: null,
      active: true,
      commission_bps: 2000,
      payout_wait_days: 21,
      inactive_after_days: 400,
      last_active_at: null,
    };
    let { error } = await supabase.from("agent_links").insert(row);
    if (error && missingColumn(error, "payout_wait_days")) {
      const { payout_wait_days: _w, ...rest } = row;
      ({ error } = await supabase.from("agent_links").insert(rest));
    }
    if (!error) {
      return NextResponse.json({ agent: normalizeAgent(row) });
    }
    if ((error as any).code !== "23505") return NextResponse.json({ error: (error as any).message }, { status: 500 });
  }
  return NextResponse.json({ error: "Could not create agent link. Try again." }, { status: 500 });
}

export async function PATCH(req: Request) {
  const gate = await requireOwner();
  if (!gate.ok) return gate.res;
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  // IMPORTANT: owners can only provide the payout destination account.
  if (typeof body.payout_stripe_account_id === "string")
    patch.payout_stripe_account_id = body.payout_stripe_account_id.trim() || null;

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "No changes." }, { status: 400 });

  // Update the first agent link for this email (there should be just one).
  let { data, error } = await supabase
    .from("agent_links")
    .update(patch)
    .eq("agent_email", gate.email)
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error && missingColumn(error, "payout_wait_days") && "payout_wait_days" in patch) {
    const { payout_wait_days: _w, ...rest } = patch;
    if (Object.keys(rest).length === 0) {
      return NextResponse.json(
        { error: "Database is missing column agent_links.payout_wait_days. Run migration 0020, then retry." },
        { status: 503 },
      );
    }
    ({ data, error } = await supabase
      .from("agent_links")
      .update(rest)
      .eq("agent_email", gate.email)
      .select("*")
      .limit(1)
      .maybeSingle());
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ agent: normalizeAgent(data) });
}

