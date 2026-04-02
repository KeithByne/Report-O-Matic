import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { isSaasOwnerEmail } from "@/lib/auth/saasOwner";
import { SaasOwnerTenantView } from "@/components/saas-owner/SaasOwnerTenantView";

export default async function SaasOwnerTenantPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const token = (await cookies()).get("rom_session")?.value || "";
  const session = token ? verifySession(token) : null;
  if (!session) redirect("/landing.html");
  if (!isSaasOwnerEmail(session.email)) redirect("/dashboard");

  return <SaasOwnerTenantView tenantId={tenantId} viewerEmail={session.email} />;
}
