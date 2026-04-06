/** Stable weekday keys stored in DB and APIs (Monday-first calendar order). */
export const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

const ALLOWED = new Set<string>(WEEKDAY_KEYS);

export function isWeekdayKey(s: string): s is WeekdayKey {
  return ALLOWED.has(s);
}

/** Dedupe, keep Mon→Sun order, drop invalid entries. */
export function normalizeActiveWeekdays(input: unknown): WeekdayKey[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<WeekdayKey>();
  const out: WeekdayKey[] = [];
  for (const k of WEEKDAY_KEYS) {
    if (input.includes(k) && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}

export function parseActiveWeekdaysFromDb(raw: unknown): WeekdayKey[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  const step = raw
    .map((x) => (typeof x === "string" ? x.trim().toLowerCase() : ""))
    .filter((x): x is WeekdayKey => isWeekdayKey(x));
  return normalizeActiveWeekdays(step);
}

/** Default meeting days when none are set yet — still produce a printable register grid. */
export const REGISTER_FALLBACK_WEEKDAYS: WeekdayKey[] = ["mon", "tue", "wed", "thu", "fri"];

export function effectiveActiveWeekdaysForRegister(activeWeekdays: WeekdayKey[]): WeekdayKey[] {
  return activeWeekdays.length > 0 ? activeWeekdays : REGISTER_FALLBACK_WEEKDAYS;
}

/** Five-week register: one column per class meeting in that window. */
export function registerSessionColumnCount(activeWeekdays: WeekdayKey[]): number {
  return activeWeekdays.length * 5;
}
