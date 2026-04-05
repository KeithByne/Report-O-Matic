import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { ProfileEditor } from "@/components/dashboard/ProfileEditor";
import { getMembershipsForEmail, type RomRole } from "@/lib/data/memberships";
import { formatDisplayNameFromProfile, getProfileForEmail } from "@/lib/data/userProfile";

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

  let userDisplayName = "";
  try {
    userDisplayName = formatDisplayNameFromProfile(await getProfileForEmail(session.email));
  } catch {
    userDisplayName = "";
  }

  return <ProfileEditor userDisplayName={userDisplayName} membershipRoles={membershipRoles} />;
}
