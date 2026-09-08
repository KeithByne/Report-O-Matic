/** Max morning or afternoon teaching periods a school may configure. */
export const TIMETABLE_MAX_PERIODS_PER_HALF = 12;

export const TIMETABLE_PERIOD_COUNT_OPTIONS = Array.from(
  { length: TIMETABLE_MAX_PERIODS_PER_HALF },
  (_, i) => i + 1,
);

/**
 * How many consecutive periods can start at `periodIndex` without crossing lunch
 * or the end of the school day (AM and PM blocks stay separate).
 */
export function maxPeriodSpanFrom(
  periodIndex: number,
  periodsAm: number,
  periodsPm: number,
): number {
  const total = periodsAm + periodsPm;
  if (!Number.isFinite(periodIndex) || periodIndex < 0 || periodIndex >= total) return 0;
  if (periodIndex < periodsAm) return periodsAm - periodIndex;
  return total - periodIndex;
}

export function parsePeriodSpan(raw: unknown, fallback = 1): number {
  const n = typeof raw === "number" ? Math.floor(raw) : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(TIMETABLE_MAX_PERIODS_PER_HALF, n);
}
