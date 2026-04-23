/** Human label for a timetable period index (matches grid / timetable_slots.period_index). */
export function labelForLessonPeriodIndex(
  periodsAm: number,
  periodsPm: number,
  periodIndex: number,
  t: (key: string, vars: { n: number }) => string,
): string {
  const total = periodsAm + periodsPm;
  if (!Number.isFinite(periodIndex) || periodIndex < 0 || periodIndex >= total) return "—";
  if (periodIndex < periodsAm) return t("pdf.timetablePeriodAm", { n: periodIndex + 1 });
  return t("pdf.timetablePeriodPm", { n: periodIndex - periodsAm + 1 });
}
