import { NextResponse } from "next/server";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { getClassInTenant } from "@/lib/data/classesDb";
import { getRoleForTenant, listMembersForTenant } from "@/lib/data/memberships";
import {
  deleteTimetableSlot,
  getTimetableSettings,
  isTimetableConflictError,
  updateTimetableSlot,
} from "@/lib/data/timetableDb";

export const runtime = "nodejs";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function conflictMessage(kind: "room" | "teacher"): string {
  if (kind === "room") return "That room is already used in this period. Change or remove the other entry first.";
  return "That teacher is already teaching in this period. Change or remove the other entry first.";
}

export async function PATCH(req: Request, context: { params: Promise<{ tenantId: string; slotId: string }> }) {
  const { tenantId, slotId } = await context.params;
  if (!isUuid(tenantId) || !isUuid(slotId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

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

  const patch: Parameters<typeof updateTimetableSlot>[2] = {};
  if (body.day_of_week !== undefined) {
    if (typeof body.day_of_week !== "number" || !Number.isFinite(body.day_of_week)) {
      return NextResponse.json({ error: "day_of_week must be a number." }, { status: 400 });
    }
    patch.day_of_week = Math.floor(body.day_of_week);
    if (patch.day_of_week < 0 || patch.day_of_week > 4) {
      return NextResponse.json({ error: "day_of_week must be 0–4 (Monday–Friday)." }, { status: 400 });
    }
  }
  if (body.period_index !== undefined) {
    if (typeof body.period_index !== "number" || !Number.isFinite(body.period_index)) {
      return NextResponse.json({ error: "period_index must be a number." }, { status: 400 });
    }
    patch.period_index = Math.floor(body.period_index);
  }
  if (body.room_index !== undefined) {
    if (typeof body.room_index !== "number" || !Number.isFinite(body.room_index)) {
      return NextResponse.json({ error: "room_index must be a number." }, { status: 400 });
    }
    patch.room_index = Math.floor(body.room_index);
  }
  if (body.class_id !== undefined) {
    if (typeof body.class_id !== "string" || !isUuid(body.class_id.trim())) {
      return NextResponse.json({ error: "class_id must be a valid id." }, { status: 400 });
    }
    patch.class_id = body.class_id.trim();
  }
  if (body.teacher_email !== undefined) {
    if (typeof body.teacher_email !== "string" || !body.teacher_email.trim()) {
      return NextResponse.json({ error: "teacher_email must be a non-empty string." }, { status: 400 });
    }
    patch.teacher_email = body.teacher_email.trim().toLowerCase();
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No changes supplied." }, { status: 400 });
  }

  const settings = await getTimetableSettings(tenantId);
  if (!settings) return NextResponse.json({ error: "School not found." }, { status: 404 });

  const periodTotal = settings.periods_am + settings.periods_pm;
  if (patch.period_index !== undefined && (patch.period_index < 0 || patch.period_index >= periodTotal)) {
    return NextResponse.json({ error: "period_index is out of range for this school’s period configuration." }, { status: 400 });
  }
  if (patch.room_index !== undefined && (patch.room_index < 0 || patch.room_index >= settings.room_count)) {
    return NextResponse.json({ error: "room_index is out of range for this school’s room count." }, { status: 400 });
  }

  if (patch.class_id) {
    const klass = await getClassInTenant(tenantId, patch.class_id);
    if (!klass) return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  if (patch.teacher_email) {
    const members = await listMembersForTenant(tenantId);
    const ok = members.some((m) => m.user_email === patch.teacher_email && m.role === "teacher");
    if (!ok) {
      return NextResponse.json({ error: "The teacher must be an invited teacher on the school roster." }, { status: 400 });
    }
  }

  try {
    const slot = await updateTimetableSlot(slotId, tenantId, patch);
    return NextResponse.json({ slot });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.toLowerCase().includes("row") || msg.includes("0 rows")) {
      return NextResponse.json({ error: "Slot not found." }, { status: 404 });
    }
    const c = isTimetableConflictError(msg);
    if (c) return NextResponse.json({ error: conflictMessage(c) }, { status: 409 });
    return NextResponse.json({ error: msg || "Failed to update slot." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ tenantId: string; slotId: string }> }) {
  const { tenantId, slotId } = await context.params;
  if (!isUuid(tenantId) || !isUuid(slotId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;

  const role = await getRoleForTenant(gate.email, tenantId);
  if (!role || (role !== "owner" && role !== "department_head")) {
    return NextResponse.json({ error: "Only owners and department heads can edit the timetable." }, { status: 403 });
  }

  try {
    const removed = await deleteTimetableSlot(slotId, tenantId);
    if (!removed) return NextResponse.json({ error: "Slot not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to delete.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
