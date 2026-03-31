import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeaderLogo, AppHeaderWordmark } from "@/components/layout/AppHeaderBrand";
import { verifySession } from "@/lib/auth/session";
import { getRoleForTenant, getTenantName } from "@/lib/data/memberships";
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

  const supabase = getServiceSupabase();
  const { data: packs } = supabase
    ? await supabase
        .from("credit_packs")
        .select("id, name, price_cents, currency, report_credits, active, sort_order")
        .eq("active", true)
        .order("sort_order", { ascending: true })
    : { data: [] };

  return (
    <div className="min-h-screen bg-emerald-50/80 text-zinc-950">
      <header className="border-b border-emerald-200/80 bg-white">
        <div className="mx-auto flex max-w-3xl items-center px-5 py-4">
          <div className="flex items-start gap-3">
            <AppHeaderLogo />
            <div>
              <AppHeaderWordmark />
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">
        <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Buy report credits</h1>
          <p className="mt-2 text-sm text-zinc-600">
            {schoolName} needs report credits before you can start creating reports.
          </p>
          {role !== "owner" ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Only school owners can purchase credits. Ask your owner to buy a pack.
            </p>
          ) : null}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {(packs ?? []).map((p: any) => (
              <form
                key={p.id}
                action={`/api/tenants/${encodeURIComponent(tenantId)}/billing/checkout`}
                method="post"
                className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4"
              >
                <input type="hidden" name="pack_id" value={String(p.id)} />
                <div className="text-sm font-semibold text-zinc-900">{String(p.name)}</div>
                <div className="mt-1 text-xs text-zinc-600">
                  {Number(p.report_credits)} reports • {(Number(p.price_cents) / 100).toFixed(2)} {String(p.currency).toUpperCase()}
                </div>
                <button
                  type="submit"
                  disabled={role !== "owner"}
                  className="mt-3 w-full rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Continue to payment
                </button>
              </form>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <Link href={`/reports/${tenantId}`} className="text-sm font-semibold text-emerald-800 hover:underline">
              Back to reports
            </Link>
            <Link href="/dashboard" className="text-sm text-zinc-600 hover:underline">
              Dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

