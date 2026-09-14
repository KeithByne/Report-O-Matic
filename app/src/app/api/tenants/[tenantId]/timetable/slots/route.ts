import { NextResponse } from "next/server";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { getClassInTenant, updateClass } from "@/lib/data/classesDb";
import { getRoleForTenant, listMembersForTenant } from "@/lib/data/memberships";
import {
  deleteTimetableSlot,
  deleteTimetableSlotsAtRoomPeriods,
  deleteTimetableSlotsForClassAtPeriods,
  getTimetableSettings,
  insertTimetableLessonBlock,
  isTimetableConflictError,
  listTimetableSlotsAtRoomPeriods,
  listTimetableSlotsForTeacherAtPeriods,
} from "@/lib/data/timetableDb";
import {
  allowedTimetableDayIndexSet,
  schoolWeekdaysToSortedDayIndexes,
  timetableMirrorDaysFilteredForSchool,
} from "@/lib/timetable/timetableSchoolWeekdays";
import { maxPeriodSpanFrom, parsePeriodSpan } from "@/lib/timetable/timetablePeriodLimits";

export const runtime = "nodejs";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function conflictMessage(kind: "room" | "teacher"): string {
  if (kind === "room") {
    return "That room is already used in this period (possibly on another weekday). Use “Free this room/period” on the empty cell, or clear the other lesson first.";
  }
  return "That teacher is already teaching in this period (often in another room). Clear that other lesson on the timetable before placing this class here.";
}

const CLASS_TEACHER_REQUIRED =
  "Assign a teacher to this class on the class page before adding it to the timetable.";

function periodRange(start: number, span: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < span; i += 1) out.push(start + i);
  return out;
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
    period_span?: unknown;
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
  const period_span = parsePeriodSpan(body.period_span, 1);

  if (!Number.isFinite(day_of_week) || day_of_week < 0 || day_of_week > 6) {
    return NextResponse.json({ error: "day_of_week must be 0–6 (Monday–Sunday)." }, { status: 400 });
  }
  if (!class_id || !isUuid(class_id)) {
    return NextResponse.json({ error: "class_id is required." }, { status: 400 });
  }

  const settings = await getTimetableSettings(tenantId);
  if (!settings) return NextResponse.json({ error: "School not found." }, { status: 404 });
  if (!allowedTimetableDayIndexSet(settings.school_weekdays).has(day_of_week)) {
    return NextResponse.json(
      { error: "That weekday is not enabled for this school’s timetable. Change school days in timetable settings first." },
      { status: 400 },
    );
  }

  const periodTotal = settings.periods_am + settings.periods_pm;
  if (!Number.isFinite(period_index) || period_index < 0 || period_index >= periodTotal) {
    return NextResponse.json({ error: "period_index is out of range for this school’s period configuration." }, { status: 400 });
  }
  const maxSpan = maxPeriodSpanFrom(period_index, settings.periods_am, settings.periods_pm);
  if (period_span > maxSpan) {
    return NextResponse.json(
      {
        error:
          "That lesson length would cross lunch or run past the end of the morning/afternoon. Shorten it or start earlier.",
      },
      { status: 400 },
    );
  }
  if (!Number.isFinite(room_index) || room_index < 0 || room_index >= settings.room_count) {
    return NextResponse.json({ error: "room_index is out of range for this school’s room count." }, { status: 400 });
  }

  const klass = await getClassInTenant(tenantId, class_id);
  if (!klass) return NextResponse.json({ error: "Class not found." }, { status: 404 });

  const teacher_email = klass.assigned_teacher_email?.trim().toLowerCase() ?? "";
  if (!teacher_email) {
    return NextResponse.json({ error: CLASS_TEACHER_REQUIRED }, { status: 400 });
  }

  const members = await listMembersForTenant(tenantId);
  const onRoster = members.some((m) => m.user_email.trim().toLowerCase() === teacher_email);
  if (!onRoster) {
    return NextResponse.json(
      { error: "The class assignee must be a member of this school (owner, department head, or teacher)." },
      { status: 400 },
    );
  }

  const days = timetableMirrorDaysFilteredForSchool(klass, day_of_week, settings.school_weekdays);
  if (days.length === 0) {
    return NextResponse.json(
      {
        error:
          "No class meeting day matches this cell on the school’s timetable. Adjust class active weekdays or school working days.",
      },
      { status: 400 },
    );
  }

  const periods = periodRange(period_index, period_span);

  // Teacher already booked in these periods (other class / other room) — surface clearly before wipe/insert.
  const teacherBusy = await listTimetableSlotsForTeacherAtPeriods(tenantId, teacher_email, periods, days);
  const teacherClash = teacherBusy.find((s) => s.class_id !== class_id);
  if (teacherClash) {
    const otherName = (teacherClash.class_name ?? "").trim() || "another class";
    return NextResponse.json(
      {
        error: `That teacher is already teaching ${otherName} in this period (room ${teacherClash.room_index + 1}). Clear that lesson first, then place this class.`,
        conflict: "teacher",
        blocking_slot: teacherClash,
      },
      { status: 409 },
    );
  }

  // Claim target cells (ghosts / prior occupants) and move this class off any other room for these periods.
  await deleteTimetableSlotsForClassAtPeriods(tenantId, class_id, periods, days);
  await deleteTimetableSlotsAtRoomPeriods(tenantId, room_index, periods, days);

  const created: Awaited<ReturnType<typeof insertTimetableLessonBlock>>[number][] = [];

  try {
    for (const d of days) {
      const block = await insertTimetableLessonBlock({
        tenantId,
        day_of_week: d,
        period_index,
        period_span,
        room_index,
        class_id,
        teacher_email,
      });
      created.push(...block);
    }
    const anchor =
      created.find((s) => s.day_of_week === day_of_week && s.period_index === period_index) ?? created[0];

    // Keep Class Settings in sync with the live timetable placement.
    try {
      await updateClass(tenantId, class_id, {
        preferred_room_index: room_index,
        preferred_lesson_period_index: period_index,
      });
    } catch {
      /* placement succeeded; settings sync is best-effort */
    }

    return NextResponse.json({ slot: anchor, slots: created, period_span });
  } catch (e: unknown) {
    for (const s of created) {
      try {
        await deleteTimetableSlot(s.id, tenantId);
      } catch {
        /* best-effort rollback */
      }
    }
    const msg = e instanceof Error ? e.message : "";
    const c = isTimetableConflictError(msg);
    if (c) return NextResponse.json({ error: conflictMessage(c) }, { status: 409 });
    return NextResponse.json({ error: msg || "Failed to save slot." }, { status: 500 });
  }
}

/** Free room/period cells without needing a visible slot id (ghost occupancy). */
export async function DELETE(req: Request, context: { params: Promise<{ tenantId: string }> }) {
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
    period_span?: unknown;
    all_school_days?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const day_of_week = typeof body.day_of_week === "number" ? Math.floor(body.day_of_week) : NaN;
  const period_index = typeof body.period_index === "number" ? Math.floor(body.period_index) : NaN;
  const room_index = typeof body.room_index === "number" ? Math.floor(body.room_index) : NaN;
  const period_span = parsePeriodSpan(body.period_span, 1);
  const allSchoolDays = body.all_school_days !== false;

  if (!Number.isFinite(day_of_week) || day_of_week < 0 || day_of_week > 6) {
    return NextResponse.json({ error: "day_of_week must be 0–6 (Monday–Sunday)." }, { status: 400 });
  }

  const settings = await getTimetableSettings(tenantId);
  if (!settings) return NextResponse.json({ error: "School not found." }, { status: 404 });

  const periodTotal = settings.periods_am + settings.periods_pm;
  if (!Number.isFinite(period_index) || period_index < 0 || period_index >= periodTotal) {
    return NextResponse.json({ error: "period_index is out of range for this school’s period configuration." }, { status: 400 });
  }
  const maxSpan = maxPeriodSpanFrom(period_index, settings.periods_am, settings.periods_pm);
  if (period_span > maxSpan) {
    return NextResponse.json(
      { error: "That lesson length would cross lunch or run past the end of the morning/afternoon." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(room_index) || room_index < 0 || room_index >= settings.room_count) {
    return NextResponse.json({ error: "room_index is out of range for this school’s room count." }, { status: 400 });
  }

  const periods = periodRange(period_index, period_span);
  const clearDays = allSchoolDays
    ? schoolWeekdaysToSortedDayIndexes(settings.school_weekdays)
    : [day_of_week];
  if (clearDays.length === 0) {
    return NextResponse.json({ error: "No school days configured." }, { status: 400 });
  }

  const before = await listTimetableSlotsAtRoomPeriods(tenantId, room_index, periods, clearDays);

  await deleteTimetableSlotsAtRoomPeriods(tenantId, room_index, periods, clearDays);

  return NextResponse.json({
    ok: true,
    cleared_periods: periods,
    cleared_days: clearDays,
    removed: before.length,
  });
}
