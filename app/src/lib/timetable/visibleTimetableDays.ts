import { isWeekdayKey, type WeekdayKey } from "@/lib/activeWeekdays";

/** Mon–Fri indices used by timetable (`day_of_week` in slots). */
const TIMETABLE_DAY_INDEX: Partial<Record<WeekdayKey, number>> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
};

export type ClassLikeWithWeekdays = {
  active_weekdays?: readonly string[] | readonly WeekdayKey[] | null;
};

/** Union of Mon–Fri meeting days from all classes; if none set, all five. */
export function visibleMonFriDayIndexesFromClasses(classes: ClassLikeWithWeekdays[]): number[] {
  const set = new Set<number>();
  for (const c of classes) {
    const aw = c.active_weekdays;
    if (!Array.isArray(aw)) continue;
    for (const raw of aw) {
      if (typeof raw !== "string") continue;
      const k = raw.trim().toLowerCase();
      if (!isWeekdayKey(k)) continue;
      const idx = TIMETABLE_DAY_INDEX[k];
      if (idx !== undefined) set.add(idx);
    }
  }
  if (set.size === 0) return [0, 1, 2, 3, 4];
  return [0, 1, 2, 3, 4].filter((d) => set.has(d));
}
