import type { GradeRubricProfile } from "@/lib/gradeRubricProfile";
import { GRADE_RUBRIC_PROFILES } from "@/lib/gradeRubricProfile";
import { REPORT_SUBJECTS } from "@/lib/subjects";
import { subjectLabelLocalized, type UiLang } from "@/lib/i18n/uiStrings";

export type CustomSubjectRow = { name: string; rubric_profile: GradeRubricProfile };

/** Suggestions for “Language acquisition”: built-in language titles + customs stored under `language`. */
export function buildLanguageAcquisitionSubjectSuggestions(rows: readonly CustomSubjectRow[], uiLang: UiLang): string[] {
  const customs = rows.filter((r) => r.rubric_profile === "language").map((r) => r.name.trim()).filter(Boolean);
  const presetLabels = REPORT_SUBJECTS.map((s) => subjectLabelLocalized(uiLang, s.code));
  return [...new Set([...presetLabels, ...customs])];
}

/** Suggestions for “Primary / general”: only customs stored under `primary`. */
export function buildPrimarySubjectSuggestions(rows: readonly CustomSubjectRow[]): string[] {
  const customs = rows.filter((r) => r.rubric_profile === "primary").map((r) => r.name.trim()).filter(Boolean);
  return [...new Set(customs)];
}

/** Suggestions for “Secondary / general”: only customs stored under `secondary`. */
export function buildSecondarySubjectSuggestions(rows: readonly CustomSubjectRow[]): string[] {
  const customs = rows.filter((r) => r.rubric_profile === "secondary").map((r) => r.name.trim()).filter(Boolean);
  return [...new Set(customs)];
}

const BUILDERS: Record<
  GradeRubricProfile,
  (rows: readonly CustomSubjectRow[], uiLang: UiLang) => string[]
> = {
  language: (rows, uiLang) => buildLanguageAcquisitionSubjectSuggestions(rows, uiLang),
  primary: (rows) => buildPrimarySubjectSuggestions(rows),
  secondary: (rows) => buildSecondarySubjectSuggestions(rows),
};

/** Labels for the datalist tied to one education type (three independent lists in the UI). */
export function subjectSuggestionLabelsForRubric(
  rubric: GradeRubricProfile,
  rows: readonly CustomSubjectRow[],
  uiLang: UiLang,
): string[] {
  return BUILDERS[rubric](rows, uiLang);
}

/** All three lists at once (e.g. render one `<datalist>` per `GRADE_RUBRIC_PROFILES` entry). */
export function subjectSuggestionLabelsByRubric(rows: readonly CustomSubjectRow[], uiLang: UiLang): Record<GradeRubricProfile, string[]> {
  const out = {} as Record<GradeRubricProfile, string[]>;
  for (const rp of GRADE_RUBRIC_PROFILES) {
    out[rp] = BUILDERS[rp](rows, uiLang);
  }
  return out;
}
