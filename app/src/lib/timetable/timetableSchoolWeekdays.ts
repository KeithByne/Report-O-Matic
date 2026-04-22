import { WEEKDAY_KEYS, normalizeActiveWeekdays, type WeekdayKey } from "@/lib/activeWeekdays";
import type { ClassRow } from "@/lib/data/classesDb";

import { timetableMirrorDayIndices } from "@/lib/timetable/timetableMirrorDays";

/** Default when column missing or JSON empty / invalid. */
export const DEFAULT_TIMETABLE_SCHOOL_WEEKDAYS: WeekdayKey[] = ["mon", "tue", "wed", "thu", "fri"];

/** Parse tenant JSON; returns Mon–Fri default if nothing valid remains. */
export function timetableSchoolWeekdaysFromDb(raw: unknown): WeekdayKey[] {
  if (raw == null) return [...DEFAULT_TIMETABLE_SCHOOL_WEEKDAYS];
  if (!Array.isArray(raw)) return [...DEFAULT_TIMETABLE_SCHOOL_WEEKDAYS];
  const n = normalizeActiveWeekdays(raw);
  return n.length > 0 ? n : [...DEFAULT_TIMETABLE_SCHOOL_WEEKDAYS];
}

/** Sorted 0–6 indices (Mon=0 … Sun=6) for grid / PDF rows. */
export function schoolWeekdaysToSortedDayIndexes(days: readonly WeekdayKey[]): number[] {
  const idx = days.map((k) => WEEKDAY_KEYS.indexOf(k)).filter((i) => i >= 0);
  return [...new Set(idx)].sort((a, b) => a - b);
}

export function allowedTimetableDayIndexSet(days: readonly WeekdayKey[]): Set<number> {
  return new Set(schoolWeekdaysToSortedDayIndexes(days));
}

/** Mirror fill restricted to school-enabled weekdays; empty if anchor day is not a school day. */
export function timetableMirrorDaysFilteredForSchool(
  klass: ClassRow,
  anchorDay: number,
  schoolWeekdays: readonly WeekdayKey[],
): number[] {
  const allowed = allowedTimetableDayIndexSet(schoolWeekdays);
  if (!allowed.has(anchorDay)) return [];
  return timetableMirrorDayIndices(klass, anchorDay).filter((d) => allowed.has(d));
}
