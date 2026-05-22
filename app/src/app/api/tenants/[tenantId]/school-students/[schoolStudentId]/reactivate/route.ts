import { NextResponse } from "next/server";
import { canManageSchoolRoster } from "@/lib/auth/schoolRoster";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { getRoleForTenant } from "@/lib/data/memberships";
import { getSchoolStudentInTenant, reactivateSchoolStudent } from "@/lib/data/schoolStudents";
import { logStudentEvent } from "@/lib/data/studentEvents";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function POST(
  _req: Request,
  context: { params: Promise<{ tenantId: string; schoolStudentId: string }> },
) {
  const { tenantId, schoolStudentId } = await context.params;
  if (!isUuid(tenantId) || !isUuid(schoolStudentId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (!canManageSchoolRoster(role)) {
    return NextResponse.json({ error: "Only owners and department heads can re-activate pupils." }, { status: 403 });
  }

  try {
    const existing = await getSchoolStudentInTenant(tenantId, schoolStudentId);
    if (!existing) return NextResponse.json({ error: "Pupil not found." }, { status: 404 });
    if (existing.status !== "inactive") {
      return NextResponse.json({ error: "Pupil is not on the inactive list." }, { status: 400 });
    }
    const student = await reactivateSchoolStudent(tenantId, schoolStudentId);
    await logStudentEvent({
      tenantId,
      actorEmail: gate.email,
      type: "reactivated",
      schoolStudentId,
    });
    return NextResponse.json({ student });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to re-activate pupil.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
