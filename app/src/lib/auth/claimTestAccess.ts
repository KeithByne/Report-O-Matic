import { getServiceSupabase } from "@/lib/supabase/service";

export async function claimTestAccessIfNeeded(opts: {
  email: string;
  testAccessToken: string | null;
  nowMs: number;
}): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const { email, testAccessToken, nowMs } = opts;
  if (!testAccessToken) return { ok: true };
  const supabase = getServiceSupabase();
  if (!supabase) return { ok: false, status: 503, message: "Database not configured." };

  const { data: link, error: lErr } = await supabase
    .from("test_access_links")
    .select("token, tenant_id, active")
    .eq("token", testAccessToken)
    .maybeSingle();
  if (lErr) return { ok: false, status: 500, message: lErr.message || "Could not claim test access." };
  if (!link || !(link as { active?: boolean }).active) {
    return { ok: false, status: 400, message: "Test access link is invalid or has already been used." };
  }

  const tenantId = String((link as { tenant_id?: string }).tenant_id || "").trim();
  if (!tenantId) return { ok: false, status: 400, message: "Invalid test tenant." };

  const { error: mErr } = await supabase.from("memberships").insert({
    tenant_id: tenantId,
    user_email: email,
    role: "owner",
  });
  if (mErr) {
    if (mErr.code === "23505") {
      return {
        ok: false,
        status: 409,
        message: "This test link was already used with a different step. Request a new link.",
      };
    }
    return { ok: false, status: 500, message: mErr.message || "Could not grant test access." };
  }

  const { error: cErr } = await supabase.from("owner_credit_ledger").insert({
    owner_email: email,
    delta_credits: 50,
    reason: "manual_adjust",
    tenant_id: tenantId,
    report_id: null,
    stripe_event_id: null,
  });
  if (cErr) {
    await supabase.from("memberships").delete().eq("tenant_id", tenantId).eq("user_email", email).eq("role", "owner");
    return { ok: false, status: 500, message: cErr.message || "Could not grant test credits." };
  }

  const { error: claimErr } = await supabase
    .from("test_access_links")
    .update({ active: false, claimed_by_email: email, claimed_at: new Date(nowMs).toISOString() })
    .eq("token", testAccessToken)
    .eq("active", true);
  if (claimErr) {
    return { ok: false, status: 500, message: claimErr.message || "Could not finalize test access." };
  }
  return { ok: true };
}
