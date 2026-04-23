import type { ClassRow } from "@/lib/data/classesDb";
import { listMembersForTenant } from "@/lib/data/memberships";
import {
  deleteTimetableSlot,
  deleteTimetableSlotsForClass,
  getTimetableSettings,
  insertTimetableSlot,
} from "@/lib/data/timetableDb";
import { allowedTimetableDayIndexSet, schoolWeekdaysToSortedDayIndexes, timetableMirrorDaysFilteredForSchool } from "@/lib/timetable/timetableSchoolWeekdays";

/**
 * When class settings include room, lesson period, active weekdays, and an assigned teacher,
 * rebuild this class’s timetable slot rows so the grid matches the saved preset.
 * Call only after PATCH fields that affect timetable placement (room / period / days / assignee).
 */
export async function syncClassPresetToTimetableSlots(tenantId: string, klass: ClassRow): Promise<void> {
  const teacher = klass.assigned_teacher_email?.trim().toLowerCase() ?? "";
  const room = klass.preferred_room_index;
  const period = klass.preferred_lesson_period_index;
  const days = klass.active_weekdays ?? [];

  if (!teacher || room == null || period == null || days.length === 0) {
    return;
  }

  const settings = await getTimetableSettings(tenantId);
  if (!settings) return;

  const periodTotal = settings.periods_am + settings.periods_pm;
  if (periodTotal < 1 || period < 0 || period >= periodTotal || room < 0 || room >= settings.room_count) {
    return;
  }

  const members = await listMembersForTenant(tenantId);
  const onRoster = members.some((m) => m.user_email.trim().toLowerCase() === teacher);
  if (!onRoster) return;

  const schoolAllowed = allowedTimetableDayIndexSet(settings.school_weekdays);
  const eligible = schoolWeekdaysToSortedDayIndexes(days).filter((d) => schoolAllowed.has(d));
  if (eligible.length === 0) return;

  const anchor = eligible[0]!;
  const mirrorRaw = timetableMirrorDaysFilteredForSchool(klass, anchor, settings.school_weekdays);
  /** DB timetable_slots.day_of_week is currently Mon–Fri only (0–4). */
  const mirrorDays = mirrorRaw.filter((d) => d >= 0 && d <= 4);
  if (mirrorDays.length === 0) return;

  await deleteTimetableSlotsForClass(tenantId, klass.id);

  const createdIds: string[] = [];
  try {
    for (const d of mirrorDays) {
      const row = await insertTimetableSlot({
        tenantId,
        day_of_week: d,
        period_index: period,
        room_index: room,
        class_id: klass.id,
        teacher_email: teacher,
      });
      createdIds.push(row.id);
    }
  } catch (e) {
    for (const id of createdIds) {
      try {
        await deleteTimetableSlot(id, tenantId);
      } catch {
        /* best-effort rollback */
      }
    }
    throw e instanceof Error ? e : new Error("Failed to create timetable slots from class settings.");
  }
}
