import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { canAccessClass } from "@/lib/auth/classAccess";
import { verifySession } from "@/lib/auth/session";
import { ClassWorkspace } from "@/components/reports/ClassWorkspace";
import { ReportsFlowHeader } from "@/components/layout/ReportsFlowHeader";
import { getClassInTenant } from "@/lib/data/classesDb";
import { getRoleForTenant, getTenantName } from "@/lib/data/memberships";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export default async function ClassReportsPage({
  params,
}: {
  params: Promise<{ tenantId: string; classId: string }>;
}) {
  const { tenantId, classId } = await params;
  if (!isUuid(tenantId) || !isUuid(classId)) redirect("/reports");

  const token = (await cookies()).get("rom_session")?.value || "";
  const session = token ? verifySession(token) : null;
  if (!session) redirect("/landing.html");

  const role = await getRoleForTenant(session.email, tenantId);
  if (!role) redirect("/reports");

  const cls = await getClassInTenant(tenantId, classId);
  if (!cls) redirect(`/reports/${tenantId}`);
  if (!canAccessClass({ role, viewerEmail: session.email, klass: cls })) {
    redirect(`/reports/${tenantId}`);
  }

  const schoolName = (await getTenantName(tenantId)) || "School";

  return (
    <div className="min-h-screen bg-emerald-50/80 text-zinc-950">
      <ReportsFlowHeader mode="class" title={schoolName} tenantId={tenantId} classId={classId} />
      <main className="mx-auto max-w-4xl px-5 py-8">
        <ClassWorkspace
          tenantId={tenantId}
          classId={classId}
          schoolName={schoolName}
          className={cls.name}
          viewerRole={role}
        />
      </main>
    </div>
  );
}
