import { getServiceSupabase } from "@/lib/supabase/service";

function formatErr(e: { message: string; details?: string | null; hint?: string | null }): string {
  const parts = [e.message, e.details, e.hint].filter((x): x is string => Boolean(x && String(x).trim()));
  return parts.join(" — ") || "Database error.";
}

export type TenantBillingStatus = "unpaid" | "active" | "past_due" | "canceled";

export async function getTenantBillingStatus(tenantId: string): Promise<TenantBillingStatus> {
  const supabase = getServiceSupabase();
  if (!supabase) return "unpaid";
  const { data, error } = await supabase
    .from("tenant_billing")
    .select("status")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(formatErr(error));
  const s = (data as { status?: string } | null)?.status ?? "unpaid";
  return s === "active" || s === "past_due" || s === "canceled" ? (s as TenantBillingStatus) : "unpaid";
}

export async function ensureTenantBillingRow(tenantId: string): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) return;
  const { error } = await supabase.from("tenant_billing").upsert(
    {
      tenant_id: tenantId,
      status: "unpaid",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" },
  );
  if (error) throw new Error(formatErr(error));
}

