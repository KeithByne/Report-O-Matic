import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ReportsFlowHeader } from "@/components/layout/ReportsFlowHeader";
import { TenantReportsHome, type TenantPanelId } from "@/components/reports/TenantReportsHome";
import { verifySession } from "@/lib/auth/session";
import { getRoleForTenant, getTenantName } from "@/lib/data/memberships";
import { formatDisplayNameFromProfile, getProfileForEmail } from "@/lib/data/userProfile";
import { getTenantCreditBalance } from "@/lib/data/credits";

function initialPanelsFromQuery(panel: string | undefined): TenantPanelId[] | undefined {
  if (!panel || typeof panel !== "string") return undefined;
  const out: TenantPanelId[] = [];
  for (const part of panel
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)) {
    if (part === "welcome" || part === "overview") out.push("welcome");
    if (part === "bulk" || part === "downloads") out.push("bulk");
    if (part === "classes") out.push("classes");
    if (part === "language") out.push("language");
    if (part === "timetable") out.push("timetable");
  }
  return out.length ? out : undefined;
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export default async function ReportsTenantPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantId } = await params;
  if (!isUuid(tenantId)) redirect("/reports");

  const sp = searchParams ? await searchParams : {};
  const rawPanel = sp.panel;
  const panelParam = Array.isArray(rawPanel) ? rawPanel[0] : rawPanel;
  const initialOpenPanels = initialPanelsFromQuery(typeof panelParam === "string" ? panelParam : undefined);

  const token = (await cookies()).get("rom_session")?.value || "";
  const session = token ? verifySession(token) : null;
  if (!session) redirect("/landing.html");

  const role = await getRoleForTenant(session.email, tenantId);
  if (!role) redirect("/reports");

  const schoolName = (await getTenantName(tenantId)) || "School";
  const credits = await getTenantCreditBalance(tenantId);
  if (credits <= 0) redirect(`/reports/${tenantId}/billing`);

  let userDisplayName = "";
  try {
    userDisplayName = formatDisplayNameFromProfile(await getProfileForEmail(session.email));
  } catch {
    userDisplayName = "";
  }

  return (
    <div className="min-h-screen bg-emerald-50/80 text-zinc-950">
      <ReportsFlowHeader
        mode="tenant"
        title={schoolName}
        tenantId={tenantId}
        showAllSchoolsLink={role === "owner"}
        userDisplayName={userDisplayName}
        viewerRole={role}
      />
      <main className="mx-auto max-w-4xl px-5 py-8">
        <TenantReportsHome
          tenantId={tenantId}
          schoolName={schoolName}
          viewerRole={role}
          bootPanels={initialOpenPanels}
        />
      </main>
    </div>
  );
}
