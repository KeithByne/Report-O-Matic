import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { isSaasOwnerEmail } from "@/lib/auth/saasOwner";
import { SaasOwnerView } from "@/components/saas-owner/SaasOwnerView";
import { formatDisplayNameFromProfile, getProfileForEmail } from "@/lib/data/userProfile";

export default async function SaasOwnerSecretPage() {
  const token = (await cookies()).get("rom_session")?.value || "";
  const session = token ? verifySession(token) : null;
  if (!session) redirect("/landing.html");
  if (!isSaasOwnerEmail(session.email)) redirect("/dashboard");

  let userDisplayName = "";
  try {
    userDisplayName = formatDisplayNameFromProfile(await getProfileForEmail(session.email));
  } catch {
    userDisplayName = "";
  }

  return <SaasOwnerView userDisplayName={userDisplayName} />;
}

