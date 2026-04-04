import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { ProfileEditor } from "@/components/dashboard/ProfileEditor";
import { getMembershipsForEmail, type RomRole } from "@/lib/data/memberships";

export default async function ProfilePage() {
  const token = (await cookies()).get("rom_session")?.value || "";
  const session = token ? verifySession(token) : null;
  if (!session) redirect("/landing.html");

  let membershipRoles: RomRole[] = [];
  try {
    const memberships = await getMembershipsForEmail(session.email);
    membershipRoles = memberships.map((m) => m.role);
  } catch {
    membershipRoles = [];
  }

  return <ProfileEditor viewerEmail={session.email} membershipRoles={membershipRoles} />;
}
