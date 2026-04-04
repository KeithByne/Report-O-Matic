import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ReportsFlowHeader } from "@/components/layout/ReportsFlowHeader";
import { ReportEditor } from "@/components/reports/ReportEditor";
import { verifySession } from "@/lib/auth/session";
import { getRoleForTenant, getTenantName } from "@/lib/data/memberships";
import { getTenantCreditBalance } from "@/lib/data/credits";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export default async function ReportEditPage({
  params,
}: {
  params: Promise<{ tenantId: string; classId: string; reportId: string }>;
}) {
  const { tenantId, classId, reportId } = await params;
  if (!isUuid(tenantId) || !isUuid(classId) || !isUuid(reportId)) {
    redirect("/reports");
  }

  const token = (await cookies()).get("rom_session")?.value || "";
  const session = token ? verifySession(token) : null;
  if (!session) redirect("/landing.html");

  const role = await getRoleForTenant(session.email, tenantId);
  if (!role) redirect("/reports");

  const schoolName = (await getTenantName(tenantId)) || "School";
  const credits = await getTenantCreditBalance(tenantId);
  if (credits <= 0) redirect(`/reports/${tenantId}/billing`);

  return (
    <div className="min-h-screen bg-emerald-50/80 text-zinc-950">
      <ReportsFlowHeader
        mode="report"
        title={schoolName}
        tenantId={tenantId}
        classId={classId}
        showAllSchoolsLink={role === "owner"}
      />
      <main className="mx-auto max-w-4xl px-5 py-8">
        <ReportEditor tenantId={tenantId} classId={classId} reportId={reportId} schoolName={schoolName} />
      </main>
    </div>
  );
}
