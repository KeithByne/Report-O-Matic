import { getServiceSupabase } from "@/lib/supabase/service";

function formatErr(e: { message: string; details?: string | null; hint?: string | null }): string {
  const parts = [e.message, e.details, e.hint].filter((x): x is string => Boolean(x && String(x).trim()));
  return parts.join(" — ") || "Database error.";
}

export async function getTenantCreditBalance(tenantId: string): Promise<number> {
  const supabase = getServiceSupabase();
  if (!supabase) return 0;
  const { data, error } = await supabase
    .from("tenant_credit_ledger")
    .select("delta_credits")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(formatErr(error));
  const rows = (data ?? []) as { delta_credits: number }[];
  return rows.reduce((sum, r) => sum + (Number(r.delta_credits) || 0), 0);
}

export async function creditTenantForPurchase(opts: {
  tenantId: string;
  credits: number;
  stripeEventId: string;
}): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const { error } = await supabase.from("tenant_credit_ledger").insert({
    tenant_id: opts.tenantId,
    delta_credits: Math.trunc(opts.credits),
    reason: "purchase",
    stripe_event_id: opts.stripeEventId,
  });
  if (error && error.code !== "23505") throw new Error(formatErr(error));
}

export async function consumeCreditForReport(opts: { tenantId: string; reportId: string }): Promise<boolean> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const { error } = await supabase.from("tenant_credit_ledger").insert({
    tenant_id: opts.tenantId,
    delta_credits: -1,
    reason: "consume",
    report_id: opts.reportId,
  });
  if (!error) return true;
  if (error.code === "23505") return false; // already consumed for this report
  throw new Error(formatErr(error));
}

