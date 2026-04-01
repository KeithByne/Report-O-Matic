import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { TenantBillingView } from "@/components/billing/TenantBillingView";
import { getRoleForTenant, getTenantName } from "@/lib/data/memberships";
import { getOwnerCreditBalance, getTenantCreditBalance } from "@/lib/data/credits";
import { getServiceSupabase } from "@/lib/supabase/service";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export default async function TenantBillingPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  if (!isUuid(tenantId)) redirect("/reports");

  const token = (await cookies()).get("rom_session")?.value || "";
  const session = token ? verifySession(token) : null;
  if (!session) redirect("/landing.html");

  const role = await getRoleForTenant(session.email, tenantId);
  if (!role) redirect("/reports");

  const schoolName = (await getTenantName(tenantId)) || "School";

  const accountCreditsRemaining =
    role === "owner" ? await getOwnerCreditBalance(session.email) : await getTenantCreditBalance(tenantId);

  const supabase = getServiceSupabase();
  const { data: packs } = supabase
    ? await supabase
        .from("credit_packs")
        .select("id, name, price_cents, currency, report_credits, active, sort_order")
        .eq("active", true)
        .order("sort_order", { ascending: true })
    : { data: [] };

  return (
    <TenantBillingView
      tenantId={tenantId}
      schoolName={schoolName}
      role={role}
      accountCreditsRemaining={accountCreditsRemaining}
      packs={(packs ?? []) as { id: string; name: string; price_cents: number; currency: string; report_credits: number }[]}
    />
  );
}
