import { getOwnerEmailForTenant } from "@/lib/data/memberships";
import { getServiceSupabase } from "@/lib/supabase/service";

function formatErr(e: { message: string; details?: string | null; hint?: string | null }): string {
  const parts = [e.message, e.details, e.hint].filter((x): x is string => Boolean(x && String(x).trim()));
  return parts.join(" — ") || "Database error.";
}

function normalizeOwnerEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Balance for the signed-in account owner (shared across all schools they own). */
export async function getOwnerCreditBalance(ownerEmail: string): Promise<number> {
  const supabase = getServiceSupabase();
  if (!supabase) return 0;
  const key = normalizeOwnerEmail(ownerEmail);
  if (!key) return 0;
  const { data, error } = await supabase
    .from("owner_credit_ledger")
    .select("delta_credits")
    .eq("owner_email", key);
  if (error) throw new Error(formatErr(error));
  const rows = (data ?? []) as { delta_credits: number }[];
  return rows.reduce((sum, r) => sum + (Number(r.delta_credits) || 0), 0);
}

/** Credits available for this school: the account owner’s shared pool (not per-tenant). */
export async function getTenantCreditBalance(tenantId: string): Promise<number> {
  const owner = await getOwnerEmailForTenant(tenantId);
  if (!owner) return 0;
  return getOwnerCreditBalance(owner);
}

export type CreditOwnerPurchaseOpts = {
  ownerEmail: string;
  credits: number;
  stripeEventId: string;
  /** School context for the checkout (referrals, billing UX). */
  sourceTenantId?: string;
};

export async function creditOwnerForPurchase(opts: CreditOwnerPurchaseOpts): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const owner = normalizeOwnerEmail(opts.ownerEmail);
  if (!owner) throw new Error("Owner email required to credit purchase.");
  const { error } = await supabase.from("owner_credit_ledger").insert({
    owner_email: owner,
    delta_credits: Math.trunc(opts.credits),
    reason: "purchase",
    stripe_event_id: opts.stripeEventId,
    tenant_id: opts.sourceTenantId ?? null,
    report_id: null,
  });
  if (error && error.code !== "23505") throw new Error(formatErr(error));
}

/** @deprecated Prefer creditOwnerForPurchase with buyer email from Stripe metadata. */
export async function creditTenantForPurchase(opts: {
  tenantId: string;
  credits: number;
  stripeEventId: string;
}): Promise<void> {
  const owner = await getOwnerEmailForTenant(opts.tenantId);
  if (!owner) throw new Error("No owner membership for tenant; cannot apply credits.");
  await creditOwnerForPurchase({
    ownerEmail: owner,
    credits: opts.credits,
    stripeEventId: opts.stripeEventId,
    sourceTenantId: opts.tenantId,
  });
}

export async function consumeCreditForReport(opts: { tenantId: string; reportId: string }): Promise<boolean> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const owner = await getOwnerEmailForTenant(opts.tenantId);
  if (!owner) throw new Error("No owner for tenant; cannot consume credit.");
  const { error } = await supabase.from("owner_credit_ledger").insert({
    owner_email: owner,
    delta_credits: -1,
    reason: "consume",
    report_id: opts.reportId,
    tenant_id: opts.tenantId,
  });
  if (!error) {
    // If this is a test-access tenant, decrement its remaining allowance and close at 0.
    try {
      const { data: t } = await supabase
        .from("tenants")
        .select("is_test_access, test_credits_remaining, test_closed_at")
        .eq("id", opts.tenantId)
        .maybeSingle();
      if (t && (t as any).is_test_access && !(t as any).test_closed_at) {
        const remaining = Number((t as any).test_credits_remaining ?? 0);
        if (remaining > 0) {
          const next = remaining - 1;
          await supabase
            .from("tenants")
            .update({
              test_credits_remaining: Math.max(0, next),
              test_closed_at: next <= 0 ? new Date().toISOString() : null,
            })
            .eq("id", opts.tenantId);
        }
      }
    } catch {
      // If test-credit bookkeeping fails, don't block report generation.
    }
    return true;
  }
  if (error.code === "23505") return false;
  throw new Error(formatErr(error));
}
