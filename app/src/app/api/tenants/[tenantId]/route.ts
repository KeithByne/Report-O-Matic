import { NextResponse } from "next/server";
import { canDeleteSchool } from "@/lib/auth/resourceDelete";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { deleteTenantById, getRoleForTenant } from "@/lib/data/memberships";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/** Delete the whole school (tenant) and all related data. Account owner only. */
export async function DELETE(_req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;

  const role = await getRoleForTenant(gate.email, tenantId);
  if (!role) return NextResponse.json({ error: "No access." }, { status: 403 });
  if (!canDeleteSchool(role)) {
    return NextResponse.json({ error: "Only the account owner can delete a school." }, { status: 403 });
  }

  try {
    await deleteTenantById(tenantId);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to delete school.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
