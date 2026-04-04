import { NextResponse } from "next/server";
import { getRomSessionEmail } from "@/lib/auth/getSession";
import { isSaasOwnerEmail } from "@/lib/auth/saasOwnerShared";

export { isSaasOwnerEmail, postSignInRedirectPath, SAAS_OWNER_DASHBOARD_PATH } from "@/lib/auth/saasOwnerShared";

export async function requireSaasOwner(): Promise<{ ok: true; email: string } | { ok: false; res: NextResponse }> {
  const email = await getRomSessionEmail();
  if (!email) return { ok: false, res: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  if (!isSaasOwnerEmail(email)) {
    return { ok: false, res: NextResponse.json({ error: "Not authorised." }, { status: 403 }) };
  }
  return { ok: true, email };
}
