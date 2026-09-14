import { NextResponse } from "next/server";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { getClassInTenant } from "@/lib/data/classesDb";
import { getRoleForTenant } from "@/lib/data/memberships";
import { getStudentInTenant, importPupilIntoClass } from "@/lib/data/students";
import { logStudentEvent } from "@/lib/data/studentEvents";

export const runtime = "nodejs";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/** Import a pupil from elsewhere in the school (other class or inactive roster) into a class. */
export async function POST(req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });

  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (!role || (role !== "owner" && role !== "department_head")) {
    return NextResponse.json({ error: "Only owners and department heads can import pupils." }, { status: 403 });
  }

  let body: { class_id?: unknown; student_id?: unknown; school_student_id?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const classId = typeof body.class_id === "string" ? body.class_id.trim() : "";
  const studentId = typeof body.student_id === "string" ? body.student_id.trim() : "";
  const schoolStudentId = typeof body.school_student_id === "string" ? body.school_student_id.trim() : "";

  if (!classId || !isUuid(classId)) {
    return NextResponse.json({ error: "class_id is required." }, { status: 400 });
  }
  if (studentId && !isUuid(studentId)) {
    return NextResponse.json({ error: "student_id is invalid." }, { status: 400 });
  }
  if (schoolStudentId && !isUuid(schoolStudentId)) {
    return NextResponse.json({ error: "school_student_id is invalid." }, { status: 400 });
  }
  if (!studentId && !schoolStudentId) {
    return NextResponse.json({ error: "student_id or school_student_id is required." }, { status: 400 });
  }

  try {
    const cls = await getClassInTenant(tenantId, classId);
    if (!cls) return NextResponse.json({ error: "Class not found." }, { status: 404 });

    let fromClassId: string | null = null;
    if (studentId) {
      const existing = await getStudentInTenant(tenantId, studentId);
      fromClassId = existing?.class_id ?? null;
    }

    const student = await importPupilIntoClass({
      tenantId,
      toClassId: classId,
      studentId: studentId || null,
      schoolStudentId: schoolStudentId || null,
    });

    await logStudentEvent({
      tenantId,
      actorEmail: gate.email,
      type: "moved",
      studentId: student.id,
      schoolStudentId: student.school_student_id,
      fromClassId: fromClassId && fromClassId !== classId ? fromClassId : null,
      toClassId: classId,
    });

    return NextResponse.json({ student });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to import pupil.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
