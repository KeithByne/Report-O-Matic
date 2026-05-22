import { NextResponse } from "next/server";
import { canManageSchoolRoster } from "@/lib/auth/schoolRoster";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { getRoleForTenant } from "@/lib/data/memberships";
import {
  getSchoolStudentInTenant,
  inactivateSchoolStudent,
  updateSchoolStudent,
} from "@/lib/data/schoolStudents";
import { logStudentEvent } from "@/lib/data/studentEvents";
import type { Gender } from "@/lib/data/students";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function isGender(s: string): s is Gender {
  return s === "male" || s === "female" || s === "non_binary";
}

export async function PATCH(req: Request, context: { params: Promise<{ tenantId: string; schoolStudentId: string }> }) {
  const { tenantId, schoolStudentId } = await context.params;
  if (!isUuid(tenantId) || !isUuid(schoolStudentId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (!canManageSchoolRoster(role)) {
    return NextResponse.json({ error: "Only owners and department heads can edit the school pupil list." }, { status: 403 });
  }

  let body: { first_name?: unknown; last_name?: unknown; gender?: unknown };
  try {
    body = (await req.json()) as typeof body;
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
    const existing = await getSchoolStudentInTenant(tenantId, schoolStudentId);
    if (!existing) return NextResponse.json({ error: "Pupil not found." }, { status: 404 });
    const student = await updateSchoolStudent(tenantId, schoolStudentId, patch);
    return NextResponse.json({ student });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update pupil.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Remove from Active list → Inactive archive; ends all class enrollments. */
export async function DELETE(
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
    return NextResponse.json({ error: "Only owners and department heads can remove pupils from the active list." }, { status: 403 });
  }

  try {
    const existing = await getSchoolStudentInTenant(tenantId, schoolStudentId);
    if (!existing) return NextResponse.json({ error: "Pupil not found." }, { status: 404 });
    if (existing.status !== "active") {
      return NextResponse.json({ error: "Pupil is not on the active list." }, { status: 400 });
    }
    await inactivateSchoolStudent({ tenantId, schoolStudentId, actorEmail: gate.email });
    await logStudentEvent({
      tenantId,
      actorEmail: gate.email,
      type: "inactivated",
      schoolStudentId,
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to archive pupil.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
