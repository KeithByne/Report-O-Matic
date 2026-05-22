import { NextResponse } from "next/server";
import { canAccessClass } from "@/lib/auth/classAccess";
import { canManageSchoolRoster } from "@/lib/auth/schoolRoster";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { getClassInTenant } from "@/lib/data/classesDb";
import { getRoleForTenant } from "@/lib/data/memberships";
import { getSchoolStudentInTenant } from "@/lib/data/schoolStudents";
import { enrollSchoolStudentInClass } from "@/lib/data/students";
import { logStudentEvent } from "@/lib/data/studentEvents";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/** Locate an active-list pupil into a class (does not remove them from the active list). */
export async function POST(req: Request, context: { params: Promise<{ tenantId: string; schoolStudentId: string }> }) {
  const { tenantId, schoolStudentId } = await context.params;
  if (!isUuid(tenantId) || !isUuid(schoolStudentId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (!canManageSchoolRoster(role)) {
    return NextResponse.json({ error: "Only owners and department heads can locate pupils into classes." }, { status: 403 });
  }

  let body: { class_id?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const classId = typeof body.class_id === "string" ? body.class_id.trim() : "";
  if (!classId || !isUuid(classId)) {
    return NextResponse.json({ error: "class_id is required." }, { status: 400 });
  }

  try {
    const school = await getSchoolStudentInTenant(tenantId, schoolStudentId);
    if (!school || school.status !== "active") {
      return NextResponse.json({ error: "Pupil not found on the active list." }, { status: 404 });
    }
    const klass = await getClassInTenant(tenantId, classId);
    if (!klass) return NextResponse.json({ error: "Class not found." }, { status: 404 });
    if (!canAccessClass({ role, viewerEmail: gate.email, klass })) {
      return NextResponse.json({ error: "You do not have access to this class." }, { status: 403 });
    }
    const enrollment = await enrollSchoolStudentInClass({ tenantId, schoolStudentId, classId });
    await logStudentEvent({
      tenantId,
      actorEmail: gate.email,
      type: "enrolled",
      studentId: enrollment.id,
      schoolStudentId,
      toClassId: classId,
    });
    return NextResponse.json({ enrollment });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to locate pupil in class.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
