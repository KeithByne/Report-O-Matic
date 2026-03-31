import { NextResponse } from "next/server";
import { canAccessClass } from "@/lib/auth/classAccess";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { getClassInTenant, listClasses } from "@/lib/data/classesDb";
import { getRoleForTenant } from "@/lib/data/memberships";
import { insertStudent, listStudents } from "@/lib/data/students";
import { logStudentEvent } from "@/lib/data/studentEvents";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function GET(req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (!role) return NextResponse.json({ error: "No access." }, { status: 403 });
  const url = new URL(req.url);
  const classId = url.searchParams.get("classId")?.trim() || "";
  try {
    if (classId && isUuid(classId)) {
      const cls = await getClassInTenant(tenantId, classId);
      if (!cls) return NextResponse.json({ error: "Class not found." }, { status: 404 });
      if (!canAccessClass({ role, viewerEmail: gate.email, klass: cls })) {
        return NextResponse.json({ error: "You do not have access to this class." }, { status: 403 });
      }
    }
    let students;
    if (role === "teacher" && (!classId || !isUuid(classId))) {
      const myClasses = await listClasses(tenantId, { viewerRole: role, viewerEmail: gate.email });
      const ids = myClasses.map((c) => c.id);
      students = ids.length ? await listStudents(tenantId, undefined, { classIds: ids }) : [];
    } else {
      students = await listStudents(tenantId, classId && isUuid(classId) ? classId : undefined);
    }
    return NextResponse.json({ students });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load students.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (!role) return NextResponse.json({ error: "No access." }, { status: 403 });

  let body: { display_name?: unknown; class_id?: unknown; first_name?: unknown; last_name?: unknown; gender?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const cid = typeof body.class_id === "string" ? body.class_id.trim() : "";
  if (!cid || !isUuid(cid)) return NextResponse.json({ error: "class_id is required." }, { status: 400 });

  const first = typeof body.first_name === "string" ? body.first_name.trim() : "";
  const last = typeof body.last_name === "string" ? body.last_name.trim() : "";
  const legacyName = typeof body.display_name === "string" ? body.display_name.trim() : "";
  let firstName = first;
  let lastName = last;
  if (!firstName && !lastName && legacyName) {
    const parts = legacyName.split(/\s+/).filter(Boolean);
    firstName = parts[0] ?? "";
    lastName = parts.slice(1).join(" ") || "-";
  }
  if (!firstName || !lastName) {
    return NextResponse.json({ error: "first_name and last_name are required." }, { status: 400 });
  }

  const genderRaw = typeof body.gender === "string" ? body.gender : "";
  const gender =
    genderRaw === "male" || genderRaw === "female" || genderRaw === "non_binary"
      ? (genderRaw as "male" | "female" | "non_binary")
      : null;

  try {
    const cls = await getClassInTenant(tenantId, cid);
    if (!cls) return NextResponse.json({ error: "Class not found in this organisation." }, { status: 404 });
    if (!canAccessClass({ role, viewerEmail: gate.email, klass: cls })) {
      return NextResponse.json({ error: "You cannot add students to this class." }, { status: 403 });
    }

    const student = await insertStudent({
      tenantId,
      classId: cid,
      firstName: firstName,
      lastName: lastName,
      gender,
    });
    await logStudentEvent({
      tenantId,
      actorEmail: gate.email,
      type: "added",
      studentId: student.id,
      fromClassId: null,
      toClassId: cid,
    });
    return NextResponse.json({ student });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to add student.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
