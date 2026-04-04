import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { ProfileEditor } from "@/components/dashboard/ProfileEditor";

export default async function ProfilePage() {
  const token = (await cookies()).get("rom_session")?.value || "";
  const session = token ? verifySession(token) : null;
  if (!session) redirect("/landing.html");

  return <ProfileEditor />;
}
