import { NextResponse } from "next/server";
import { requireSaasOwner } from "@/lib/auth/saasOwner";
import { deleteTenantById } from "@/lib/data/memberships";

export const runtime = "nodejs";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/** SaaS owner: delete an entire tenant (same DB cascade as owner DELETE /api/tenants/[tenantId]). */
export async function DELETE(_req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const gate = await requireSaasOwner();
  if (!gate.ok) return gate.res;

  const { tenantId } = await context.params;
  if (!tenantId || !isUuid(tenantId)) {
    return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });
  }

  try {
    await deleteTenantById(tenantId);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to delete school.";
    console.error("[ROM saas-owner tenants DELETE]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
