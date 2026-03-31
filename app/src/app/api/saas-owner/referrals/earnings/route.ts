import { NextResponse } from "next/server";
import { requireSaasOwner } from "@/lib/auth/saasOwner";
import { getServiceSupabase } from "@/lib/supabase/service";

type Status = "pending" | "eligible" | "paid" | "void";

function isStatus(s: string): s is Status {
  return s === "pending" || s === "eligible" || s === "paid" || s === "void";
}

export async function GET(req: Request) {
  const gate = await requireSaasOwner();
  if (!gate.ok) return gate.res;
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });

  const url = new URL(req.url);
  const agent = (url.searchParams.get("agent") ?? "").trim().toLowerCase();
  const statusRaw = (url.searchParams.get("status") ?? "").trim().toLowerCase();
  const status = statusRaw && isStatus(statusRaw) ? (statusRaw as Status) : null;

  const { data, error } = await supabase
    .from("referral_earnings")
    .select("id, agent_code, agent_email, tenant_id, amount_cents, currency, commission_cents, eligible_at, status, created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  const rows = (data ?? []).map((r: any) => {
    const eligible = new Date(String(r.eligible_at)).getTime() <= now;
    const computed = r.status === "pending" && eligible ? "eligible" : r.status;
    return { ...r, computed_status: computed };
  });

  const filtered = rows.filter((r: any) => {
    if (agent && String(r.agent_email || "").toLowerCase() !== agent) return false;
    if (status && String(r.computed_status) !== status) return false;
    return true;
  });

  return NextResponse.json({ earnings: filtered });
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
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const statusRaw = typeof body.status === "string" ? body.status.trim().toLowerCase() : "";
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  if (!isStatus(statusRaw)) return NextResponse.json({ error: "status must be pending|eligible|paid|void." }, { status: 400 });

  const { data, error } = await supabase
    .from("referral_earnings")
    .update({ status: statusRaw })
    .eq("id", id)
    .select("id, agent_code, agent_email, tenant_id, amount_cents, currency, commission_cents, eligible_at, status, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ earning: data });
}

