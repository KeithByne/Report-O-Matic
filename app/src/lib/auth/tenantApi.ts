import { NextResponse } from "next/server";
import { getRomSessionEmail } from "@/lib/auth/getSession";
import { getRoleForTenant } from "@/lib/data/memberships";

export async function requireTenantMember(
  tenantId: string,
): Promise<{ ok: true; email: string } | { ok: false; res: NextResponse }> {
  const email = await getRomSessionEmail();
  if (!email) {
    return { ok: false, res: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  }
  const role = await getRoleForTenant(email, tenantId);
  if (!role) {
    return { ok: false, res: NextResponse.json({ error: "No access to this organisation." }, { status: 403 }) };
  }
  return { ok: true, email };
}
