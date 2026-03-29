import { NextResponse } from "next/server";
import { canAccessClass } from "@/lib/auth/classAccess";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { getClassInTenant } from "@/lib/data/classesDb";
import { getRoleForTenant } from "@/lib/data/memberships";
import type { Gender } from "@/lib/data/students";
import { canDeleteStudent } from "@/lib/auth/resourceDelete";
import { deleteStudentInTenant, getStudentInTenant, updateStudent } from "@/lib/data/students";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function isGender(s: string): s is Gender {
  return s === "male" || s === "female" || s === "non_binary";
}

export async function PATCH(req: Request, context: { params: Promise<{ tenantId: string; studentId: string }> }) {
  const { tenantId, studentId } = await context.params;
  if (!isUuid(tenantId) || !isUuid(studentId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (!role) return NextResponse.json({ error: "No access." }, { status: 403 });

  let body: { first_name?: unknown; last_name?: unknown; gender?: unknown };
  try {
    body = (await req.json()) as { first_name?: unknown; last_name?: unknown; gender?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const patch: { first_name?: string; last_name?: string; gender?: Gender | null } = {};
  if (typeof body.first_name === "string") patch.first_name = body.first_name;
  if (typeof body.last_name === "string") patch.last_name = body.last_name;
  if (body.gender === null) patch.gender = null;
  else if (typeof body.gender === "string" && isGender(body.gender)) patch.gender = body.gender;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  try {
    const existing = await getStudentInTenant(tenantId, studentId);
    if (!existing) return NextResponse.json({ error: "Student not found." }, { status: 404 });
    const klass = await getClassInTenant(tenantId, existing.class_id);
    if (klass && !canAccessClass({ role, viewerEmail: gate.email, klass })) {
      return NextResponse.json({ error: "You cannot edit this student." }, { status: 403 });
    }
    const student = await updateStudent(tenantId, studentId, patch);
    return NextResponse.json({ student });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update student.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ tenantId: string; studentId: string }> }) {
  const { tenantId, studentId } = await context.params;
  if (!isUuid(tenantId) || !isUuid(studentId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (!role) return NextResponse.json({ error: "No access." }, { status: 403 });
  if (!canDeleteStudent(role)) {
    return NextResponse.json({ error: "You cannot delete students." }, { status: 403 });
  }

  try {
    const existing = await getStudentInTenant(tenantId, studentId);
    if (!existing) return NextResponse.json({ error: "Student not found." }, { status: 404 });
    const klass = await getClassInTenant(tenantId, existing.class_id);
    if (klass && !canAccessClass({ role, viewerEmail: gate.email, klass })) {
      return NextResponse.json({ error: "You cannot delete this student." }, { status: 403 });
    }
    await deleteStudentInTenant(tenantId, studentId);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to delete student.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
