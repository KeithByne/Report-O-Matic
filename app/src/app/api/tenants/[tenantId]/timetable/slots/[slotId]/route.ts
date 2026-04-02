import { NextResponse } from "next/server";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { getClassInTenant } from "@/lib/data/classesDb";
import { getRoleForTenant, listMembersForTenant } from "@/lib/data/memberships";
import {
  deleteTimetableSlotsMirrorKeys,
  getTimetableSettings,
  getTimetableSlot,
  insertTimetableSlot,
  isTimetableConflictError,
  listTimetableSlotsAt,
} from "@/lib/data/timetableDb";
import { timetableMirrorDayIndices } from "@/lib/timetable/timetableMirrorDays";

export const runtime = "nodejs";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function conflictMessage(kind: "room" | "teacher"): string {
  if (kind === "room") return "That room is already used in this period. Change or remove the other entry first.";
  return "That teacher is already teaching in this period. Change or remove the other entry first.";
}

const CLASS_TEACHER_REQUIRED =
  "Assign a teacher to this class on the class page before placing it on the timetable.";

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
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (Object.keys(body).length === 0 || Object.values(body).every((v) => v === undefined)) {
    return NextResponse.json({ error: "No changes supplied." }, { status: 400 });
  }

  const before = await getTimetableSlot(slotId, tenantId);
  if (!before) return NextResponse.json({ error: "Slot not found." }, { status: 404 });

  const patch: {
    day_of_week?: number;
    period_index?: number;
    room_index?: number;
    class_id?: string;
  } = {};

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

  const settings = await getTimetableSettings(tenantId);
  if (!settings) return NextResponse.json({ error: "School not found." }, { status: 404 });

  const periodTotal = settings.periods_am + settings.periods_pm;
  const resolvedDay = patch.day_of_week !== undefined ? patch.day_of_week : before.day_of_week;
  const resolvedPeriod = patch.period_index !== undefined ? patch.period_index : before.period_index;
  const resolvedRoom = patch.room_index !== undefined ? patch.room_index : before.room_index;
  const resolvedClassId = patch.class_id !== undefined ? patch.class_id : before.class_id;

  if (resolvedPeriod < 0 || resolvedPeriod >= periodTotal) {
    return NextResponse.json({ error: "period_index is out of range for this school’s period configuration." }, { status: 400 });
  }
  if (resolvedRoom < 0 || resolvedRoom >= settings.room_count) {
    return NextResponse.json({ error: "room_index is out of range for this school’s room count." }, { status: 400 });
  }

  const beforeKlass = await getClassInTenant(tenantId, before.class_id);
  if (!beforeKlass) return NextResponse.json({ error: "Class not found." }, { status: 404 });

  const afterKlass = await getClassInTenant(tenantId, resolvedClassId);
  if (!afterKlass) return NextResponse.json({ error: "Class not found." }, { status: 404 });

  const teacher = afterKlass.assigned_teacher_email?.trim().toLowerCase() ?? "";
  if (!teacher) {
    return NextResponse.json({ error: CLASS_TEACHER_REQUIRED }, { status: 400 });
  }

  const members = await listMembersForTenant(tenantId);
  const rosterOk = members.some((m) => m.user_email === teacher && m.role === "teacher");
  if (!rosterOk) {
    return NextResponse.json(
      { error: "The class’s assigned teacher must be an invited teacher on the school roster." },
      { status: 400 },
    );
  }

  const oldDays = timetableMirrorDayIndices(beforeKlass, before.day_of_week);
  const newDays = timetableMirrorDayIndices(afterKlass, resolvedDay);

  const siblingsToRestore = await listTimetableSlotsAt(
    tenantId,
    before.class_id,
    before.period_index,
    before.room_index,
    oldDays,
  );

  await deleteTimetableSlotsMirrorKeys(tenantId, before.class_id, before.period_index, before.room_index, oldDays);

  const created: Awaited<ReturnType<typeof insertTimetableSlot>>[] = [];
  try {
    for (const d of newDays) {
      created.push(
        await insertTimetableSlot({
          tenantId,
          day_of_week: d,
          period_index: resolvedPeriod,
          room_index: resolvedRoom,
          class_id: resolvedClassId,
          teacher_email: teacher,
        }),
      );
    }
    const anchor = created.find((s) => s.day_of_week === resolvedDay) ?? created[0];
    return NextResponse.json({ slot: anchor, slots: created });
  } catch (e: unknown) {
    try {
      await deleteTimetableSlotsMirrorKeys(
        tenantId,
        resolvedClassId,
        resolvedPeriod,
        resolvedRoom,
        newDays,
      );
    } catch {
      /* ignore */
    }
    for (const s of siblingsToRestore) {
      try {
        await insertTimetableSlot({
          tenantId,
          day_of_week: s.day_of_week,
          period_index: s.period_index,
          room_index: s.room_index,
          class_id: s.class_id,
          teacher_email: s.teacher_email,
        });
      } catch {
        /* best-effort */
      }
    }
    const msg = e instanceof Error ? e.message : "";
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
    const existing = await getTimetableSlot(slotId, tenantId);
    if (!existing) return NextResponse.json({ error: "Slot not found." }, { status: 404 });

    const klass = await getClassInTenant(tenantId, existing.class_id);
    if (!klass) {
      await deleteTimetableSlotsMirrorKeys(tenantId, existing.class_id, existing.period_index, existing.room_index, [
        existing.day_of_week,
      ]);
      return NextResponse.json({ ok: true });
    }

    const days = timetableMirrorDayIndices(klass, existing.day_of_week);
    await deleteTimetableSlotsMirrorKeys(
      tenantId,
      existing.class_id,
      existing.period_index,
      existing.room_index,
      days,
    );
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to delete.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
