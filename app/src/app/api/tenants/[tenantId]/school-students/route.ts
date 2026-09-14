import { NextResponse } from "next/server";
import { canUseSchoolRoster } from "@/lib/auth/schoolRoster";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { getRoleForTenant } from "@/lib/data/memberships";
import type { SchoolStudentStatus } from "@/lib/data/schoolStudents";
import {
  insertSchoolStudent,
  listAllSchoolStudentsWithClasses,
  listSchoolStudents,
} from "@/lib/data/schoolStudents";
import { logStudentEvent } from "@/lib/data/studentEvents";
import type { Gender } from "@/lib/data/students";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function GET(req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (!canUseSchoolRoster(role)) {
    return NextResponse.json({ error: "No access to the school pupil lists." }, { status: 403 });
  }
  const statusRaw = new URL(req.url).searchParams.get("status")?.trim() || "active";
  if (statusRaw !== "active" && statusRaw !== "inactive" && statusRaw !== "all") {
    return NextResponse.json({ error: "status must be active, inactive, or all." }, { status: 400 });
  }
  try {
    const students =
      statusRaw === "all"
        ? await listAllSchoolStudentsWithClasses(tenantId)
        : await listSchoolStudents(tenantId, statusRaw as SchoolStudentStatus);
    return NextResponse.json({ students });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load pupils.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (!canUseSchoolRoster(role)) {
    return NextResponse.json({ error: "No access to add pupils to the active list." }, { status: 403 });
  }

  let body: { first_name?: unknown; last_name?: unknown; gender?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const first = typeof body.first_name === "string" ? body.first_name.trim() : "";
  const last = typeof body.last_name === "string" ? body.last_name.trim() : "";
  if (!first || !last) {
    return NextResponse.json({ error: "first_name and last_name are required." }, { status: 400 });
  }
  const genderRaw = typeof body.gender === "string" ? body.gender : "";
  const gender =
    genderRaw === "male" || genderRaw === "female" || genderRaw === "non_binary"
      ? (genderRaw as Gender)
      : null;

  try {
    const student = await insertSchoolStudent({ tenantId, firstName: first, lastName: last, gender });
    await logStudentEvent({
      tenantId,
      actorEmail: gate.email,
      type: "added",
      schoolStudentId: student.id,
    });
    return NextResponse.json({
      student: {
        ...student,
        class_names: [],
        class_ids: [],
        enrollment_ids: [],
        last_class_name: null,
        last_class_id: null,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to add pupil.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
