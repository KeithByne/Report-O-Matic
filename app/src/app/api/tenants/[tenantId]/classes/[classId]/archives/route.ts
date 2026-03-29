import { NextResponse } from "next/server";
import { canAccessClass } from "@/lib/auth/classAccess";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { listScholasticArchivesForClass } from "@/lib/data/classArchives";
import { getClassInTenant } from "@/lib/data/classesDb";
import { getRoleForTenant } from "@/lib/data/memberships";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/** List archived scholastic years for this class (all roles with class access). */
export async function GET(_req: Request, context: { params: Promise<{ tenantId: string; classId: string }> }) {
  const { tenantId, classId } = await context.params;
  if (!isUuid(tenantId) || !isUuid(classId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (!role) return NextResponse.json({ error: "No access." }, { status: 403 });

  try {
    const klass = await getClassInTenant(tenantId, classId);
    if (!klass) return NextResponse.json({ error: "Class not found." }, { status: 404 });
    if (!canAccessClass({ role, viewerEmail: gate.email, klass })) {
      return NextResponse.json({ error: "You do not have access to this class." }, { status: 403 });
    }
    const archives = await listScholasticArchivesForClass(tenantId, classId);
    return NextResponse.json({ archives });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load archives.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
