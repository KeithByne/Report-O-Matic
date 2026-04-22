import { WEEKDAY_KEYS } from "@/lib/activeWeekdays";
import type { ClassRow } from "@/lib/data/classesDb";

/**
 * Weekday row indices (0=Mon … 6=Sun) to fill together from one timetable edit.
 * Uses class active weekdays; always includes `anchorDay` (the cell clicked or edited).
 */
export function timetableMirrorDayIndices(klass: ClassRow, anchorDay: number): number[] {
  const set = new Set<number>();
  for (const k of klass.active_weekdays) {
    const i = WEEKDAY_KEYS.indexOf(k);
    if (i >= 0 && i <= 6) set.add(i);
  }
  if (set.size === 0) set.add(anchorDay);
  else set.add(anchorDay);
  return [...set].sort((a, b) => a - b);
}
