import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ReportsFlowHeader } from "@/components/layout/ReportsFlowHeader";
import { TimetablePageClient } from "@/components/timetable/TimetablePageClient";
import { verifySession } from "@/lib/auth/session";
import { getRoleForTenant, getTenantName } from "@/lib/data/memberships";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export default async function TimetablePage({ params }: { params: Promise<{ tenantId: string }> }) {
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
      <ReportsFlowHeader mode="tenant" title={schoolName} tenantId={tenantId} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-5">
        <TimetablePageClient tenantId={tenantId} schoolName={schoolName} viewerRole={role} />
      </main>
    </div>
  );
}
