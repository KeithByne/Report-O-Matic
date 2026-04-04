import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardClientView } from "@/components/dashboard/DashboardClientView";
import { verifySession } from "@/lib/auth/session";
import {
  getMembershipsForEmail,
  listMembersForTenant,
  type MembershipWithTenant,
  type TenantMemberRow,
} from "@/lib/data/memberships";
import { getOwnerCreditBalance } from "@/lib/data/credits";
import { listClasses } from "@/lib/data/classesDb";
import { getTeacherStatsForTenant, getTenantSummaryStats, type TeacherStats, type TenantSummaryStats } from "@/lib/data/tenantDashboardStats";

export default async function DashboardPage() {
  const token = (await cookies()).get("rom_session")?.value || "";
  const session = token ? verifySession(token) : null;
  if (!session) redirect("/landing.html");

  let memberships: MembershipWithTenant[] = [];
  let loadError: string | null = null;
  try {
    memberships = await getMembershipsForEmail(session.email);
    memberships.sort((a, b) => a.tenantName.localeCompare(b.tenantName, undefined, { sensitivity: "base" }));
  } catch (e: unknown) {
    loadError = e instanceof Error ? e.message : "Could not load your schools.";
  }

  const rosterTenantIds = [
    ...new Set(memberships.filter((m) => m.role === "owner" || m.role === "department_head").map((m) => m.tenantId)),
  ];
  let rosterByTenant: Record<string, TenantMemberRow[]> = {};
  if (rosterTenantIds.length > 0) {
    try {
      const entries = await Promise.all(
        rosterTenantIds.map(async (tid) => {
          try {
            return [tid, await listMembersForTenant(tid)] as const;
          } catch {
            return [tid, [] as TenantMemberRow[]] as const;
          }
        }),
      );
      rosterByTenant = Object.fromEntries(entries);
    } catch {
      rosterByTenant = {};
    }
  }

  let summaryByTenant: Record<string, TenantSummaryStats> = {};
  let teacherStatsByTenant: Record<string, TeacherStats[]> = {};
  try {
    const entries = await Promise.all(
      rosterTenantIds.map(async (tid) => {
        const roster = rosterByTenant[tid] ?? [];
        const [summary, teacherStats] = await Promise.all([
          getTenantSummaryStats(tid),
          getTeacherStatsForTenant({ tenantId: tid, roster }),
        ]);
        return [tid, { summary, teacherStats }] as const;
      }),
    );
    summaryByTenant = Object.fromEntries(entries.map(([tid, x]) => [tid, x.summary]));
    teacherStatsByTenant = Object.fromEntries(entries.map(([tid, x]) => [tid, x.teacherStats]));
  } catch {
    summaryByTenant = {};
    teacherStatsByTenant = {};
  }

  const teacherTenantIds = [...new Set(memberships.filter((m) => m.role === "teacher").map((m) => m.tenantId))];
  const teacherClassIdByTenant: Record<string, string | null> = {};
  if (teacherTenantIds.length > 0) {
    await Promise.all(
      teacherTenantIds.map(async (tid) => {
        try {
          const classes = await listClasses(tid, { viewerRole: "teacher", viewerEmail: session.email });
          teacherClassIdByTenant[tid] = classes[0]?.id ?? null;
        } catch {
          teacherClassIdByTenant[tid] = null;
        }
      }),
    );
  }

  const isAccountOwner = memberships.some((m) => m.role === "owner");
  let ownerReportCredits: number | null = null;
  let firstOwnerTenantId: string | null = null;
  if (isAccountOwner) {
    try {
      ownerReportCredits = await getOwnerCreditBalance(session.email);
      firstOwnerTenantId = memberships.find((m) => m.role === "owner")?.tenantId ?? null;
    } catch {
      ownerReportCredits = 0;
    }
  }

  return (
    <DashboardClientView
      email={session.email}
      loadError={loadError}
      memberships={memberships}
      rosterByTenant={rosterByTenant}
      summaryByTenant={summaryByTenant}
      teacherStatsByTenant={teacherStatsByTenant}
      ownerReportCredits={ownerReportCredits}
      firstOwnerTenantId={firstOwnerTenantId}
      teacherClassIdByTenant={teacherClassIdByTenant}
    />
  );
}
