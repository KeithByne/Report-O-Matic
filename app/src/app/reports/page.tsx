import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ReportsIndexView } from "@/components/reports/ReportsIndexView";
import { verifySession } from "@/lib/auth/session";
import { getMembershipsForEmail, type MembershipWithTenant } from "@/lib/data/memberships";

export default async function ReportsIndexPage() {
  const token = (await cookies()).get("rom_session")?.value || "";
  const session = token ? verifySession(token) : null;
  if (!session) redirect("/landing.html");

  let memberships: MembershipWithTenant[] = [];
  let loadError: string | null = null;
  try {
    memberships = await getMembershipsForEmail(session.email);
    memberships.sort((a, b) => a.tenantName.localeCompare(b.tenantName, undefined, { sensitivity: "base" }));
  } catch (e: unknown) {
    loadError = e instanceof Error ? e.message : "Could not load schools.";
  }

  return <ReportsIndexView memberships={memberships} loadError={loadError} />;
}
