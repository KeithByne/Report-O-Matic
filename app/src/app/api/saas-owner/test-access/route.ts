import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { requireSaasOwner } from "@/lib/auth/saasOwner";
import { getServiceSupabase } from "@/lib/supabase/service";

function tokenUrlSafe(bytes = 18): string {
  // 24 chars-ish, URL-safe.
  return crypto.randomBytes(bytes).toString("base64url");
}

function testOwnerEmailForToken(token: string): string {
  const domain = (process.env.ROM_TEST_ACCESS_OWNER_DOMAIN ?? "report-o-matic.online").trim() || "report-o-matic.online";
  return `rom-test-owner+${token}@${domain}`.toLowerCase();
}

export async function POST(req: Request) {
  const gate = await requireSaasOwner();
  if (!gate.ok) return gate.res;

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });

  const token = tokenUrlSafe();
  const ownerEmail = testOwnerEmailForToken(token);
  const nowIso = new Date().toISOString();

  // Create a sandbox tenant + internal owner (not the SaaS owner) so the free credits
  // don't mix with real paid credits.
  const tenantName = `Test account (${new Date().toLocaleDateString()})`;

  const { data: tenant, error: tErr } = await supabase
    .from("tenants")
    .insert({ name: tenantName, is_test_access: true, test_credits_remaining: 50, test_closed_at: null })
    .select("id")
    .single();
  if (tErr) return NextResponse.json({ error: tErr.message || "Could not create test tenant." }, { status: 500 });

  const tenantId = String((tenant as any).id || "").trim();
  if (!tenantId) return NextResponse.json({ error: "Could not create test tenant." }, { status: 500 });

  const { error: mErr } = await supabase.from("memberships").insert({
    tenant_id: tenantId,
    user_email: ownerEmail,
    role: "owner",
  });
  if (mErr) {
    await supabase.from("tenants").delete().eq("id", tenantId);
    return NextResponse.json({ error: mErr.message || "Could not create test tenant owner." }, { status: 500 });
  }

  // Grant 50 credits to this internal owner email.
  const { error: cErr } = await supabase.from("owner_credit_ledger").insert({
    owner_email: ownerEmail,
    delta_credits: 50,
    reason: "manual_adjust",
    tenant_id: tenantId,
    report_id: null,
    stripe_event_id: null,
  });
  if (cErr) {
    await supabase.from("memberships").delete().eq("tenant_id", tenantId).eq("user_email", ownerEmail);
    await supabase.from("tenants").delete().eq("id", tenantId);
    return NextResponse.json({ error: cErr.message || "Could not grant test credits." }, { status: 500 });
  }

  const { error: lErr } = await supabase.from("test_access_links").insert({
    token,
    tenant_id: tenantId,
    created_by_email: gate.email,
    active: true,
    created_at: nowIso,
  });
  if (lErr) {
    return NextResponse.json({ error: lErr.message || "Could not create test link." }, { status: 500 });
  }

  const baseUrl = process.env.ROM_PUBLIC_BASE_URL?.trim() || new URL(req.url).origin;
  const linkUrl = `${baseUrl}/landing.html?test=${encodeURIComponent(token)}`;

  return NextResponse.json({ ok: true, tenant_id: tenantId, link_url: linkUrl });
}

