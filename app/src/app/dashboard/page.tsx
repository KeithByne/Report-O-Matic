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

  return (
    <DashboardClientView
      email={session.email}
      sessionExpMs={session.exp}
      loadError={loadError}
      memberships={memberships}
      rosterByTenant={rosterByTenant}
    />
  );
}
