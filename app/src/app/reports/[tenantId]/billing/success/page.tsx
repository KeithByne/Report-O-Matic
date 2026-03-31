import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeaderBrand } from "@/components/layout/AppHeaderBrand";
import { verifySession } from "@/lib/auth/session";
import { getRoleForTenant, getTenantName } from "@/lib/data/memberships";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export default async function BillingSuccessPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  if (!isUuid(tenantId)) redirect("/reports");

  const token = (await cookies()).get("rom_session")?.value || "";
  const session = token ? verifySession(token) : null;
  if (!session) redirect("/landing.html");

  const role = await getRoleForTenant(session.email, tenantId);
  if (!role) redirect("/reports");

  const schoolName = (await getTenantName(tenantId)) || "School";

  return (
    <div className="min-h-screen bg-emerald-50/80 text-zinc-950">
      <header className="border-b border-emerald-200/80 bg-white">
        <div className="mx-auto flex max-w-2xl items-center px-5 py-4">
          <AppHeaderBrand />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-12">
        <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-zinc-900">Payment received</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Thanks. If your credits don’t appear immediately, give it a moment for Stripe to confirm the payment.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={`/reports/${tenantId}`}
              className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white"
            >
              Continue to {schoolName}
            </Link>
            <Link href={`/reports/${tenantId}/billing`} className="rounded-lg border border-emerald-200 px-4 py-2 text-sm">
              Back to billing
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

