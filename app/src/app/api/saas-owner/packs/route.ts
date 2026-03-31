import { NextResponse } from "next/server";
import { requireSaasOwner } from "@/lib/auth/saasOwner";
import { getServiceSupabase } from "@/lib/supabase/service";

export async function GET() {
  const gate = await requireSaasOwner();
  if (!gate.ok) return gate.res;
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  const { data, error } = await supabase
    .from("credit_packs")
    .select("id, name, price_cents, currency, report_credits, active, sort_order, created_at")
    .order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ packs: data ?? [] });
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
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.currency === "string") patch.currency = body.currency.trim().toLowerCase();
  if (typeof body.price_cents === "number") patch.price_cents = Math.max(0, Math.trunc(body.price_cents));
  if (typeof body.report_credits === "number") patch.report_credits = Math.max(0, Math.trunc(body.report_credits));
  if (typeof body.active === "boolean") patch.active = body.active;
  if (typeof body.sort_order === "number") patch.sort_order = Math.trunc(body.sort_order);

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "No changes." }, { status: 400 });

  const { data, error } = await supabase
    .from("credit_packs")
    .update(patch)
    .eq("id", id)
    .select("id, name, price_cents, currency, report_credits, active, sort_order, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pack: data });
}

