import { NextResponse } from "next/server";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { getClassInTenant } from "@/lib/data/classesDb";
import { getRoleForTenant, listMembersForTenant } from "@/lib/data/memberships";
import {
  getTimetableSettings,
  insertTimetableSlot,
  isTimetableConflictError,
} from "@/lib/data/timetableDb";

export const runtime = "nodejs";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function conflictMessage(kind: "room" | "teacher"): string {
  if (kind === "room") return "That room is already used in this period. Change or remove the other entry first.";
  return "That teacher is already teaching in this period. Change or remove the other entry first.";
}

export async function POST(req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });

  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;

  const role = await getRoleForTenant(gate.email, tenantId);
  if (!role || (role !== "owner" && role !== "department_head")) {
    return NextResponse.json({ error: "Only owners and department heads can edit the timetable." }, { status: 403 });
  }

  let body: {
    day_of_week?: unknown;
    period_index?: unknown;
    room_index?: unknown;
    class_id?: unknown;
    teacher_email?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const day_of_week = typeof body.day_of_week === "number" ? Math.floor(body.day_of_week) : NaN;
  const period_index = typeof body.period_index === "number" ? Math.floor(body.period_index) : NaN;
  const room_index = typeof body.room_index === "number" ? Math.floor(body.room_index) : NaN;
  const class_id = typeof body.class_id === "string" ? body.class_id.trim() : "";
  const teacher_email = typeof body.teacher_email === "string" ? body.teacher_email.trim().toLowerCase() : "";

  if (!Number.isFinite(day_of_week) || day_of_week < 0 || day_of_week > 4) {
    return NextResponse.json({ error: "day_of_week must be 0–4 (Monday–Friday)." }, { status: 400 });
  }
  if (!class_id || !isUuid(class_id)) {
    return NextResponse.json({ error: "class_id is required." }, { status: 400 });
  }
  if (!teacher_email) {
    return NextResponse.json({ error: "teacher_email is required." }, { status: 400 });
  }

  const settings = await getTimetableSettings(tenantId);
  if (!settings) return NextResponse.json({ error: "School not found." }, { status: 404 });

  const periodTotal = settings.periods_am + settings.periods_pm;
  if (!Number.isFinite(period_index) || period_index < 0 || period_index >= periodTotal) {
    return NextResponse.json({ error: "period_index is out of range for this school’s period configuration." }, { status: 400 });
  }
  if (!Number.isFinite(room_index) || room_index < 0 || room_index >= settings.room_count) {
    return NextResponse.json({ error: "room_index is out of range for this school’s room count." }, { status: 400 });
  }

  const klass = await getClassInTenant(tenantId, class_id);
  if (!klass) return NextResponse.json({ error: "Class not found." }, { status: 404 });

  const members = await listMembersForTenant(tenantId);
  const isTeacher = members.some((m) => m.user_email === teacher_email && m.role === "teacher");
  if (!isTeacher) {
    return NextResponse.json({ error: "The teacher must be an invited teacher on the school roster." }, { status: 400 });
  }

  try {
    const slot = await insertTimetableSlot({
      tenantId,
      day_of_week,
      period_index,
      room_index,
      class_id,
      teacher_email,
    });
    return NextResponse.json({ slot });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    const c = isTimetableConflictError(msg);
    if (c) return NextResponse.json({ error: conflictMessage(c) }, { status: 409 });
    return NextResponse.json({ error: msg || "Failed to save slot." }, { status: 500 });
  }
}
