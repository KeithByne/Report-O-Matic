import type { GradeRubricProfile } from "@/lib/gradeRubricProfile";
import { isSubjectCode } from "@/lib/subjects";

/** CEFR bands stored for language-acquisition classes. */
export const CLASS_CEFR_CODES = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrLevel = (typeof CLASS_CEFR_CODES)[number];

/** Primary-style year labels (stored as shown; DB check constraint must match). */
export const CLASS_PRIMARY_YEAR_LEVELS = ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6"] as const;

/** Secondary-style year labels. */
export const CLASS_SECONDARY_YEAR_LEVELS = [
  "Year 7",
  "Year 8",
  "Year 9",
  "Year 10",
  "Year 11",
  "Year 12",
  "Year 13",
] as const;

export type PrimaryYearLevel = (typeof CLASS_PRIMARY_YEAR_LEVELS)[number];
export type SecondaryYearLevel = (typeof CLASS_SECONDARY_YEAR_LEVELS)[number];

export type ClassLevelStored = CefrLevel | PrimaryYearLevel | SecondaryYearLevel;

const ALL_LEVELS = new Set<string>([
  ...CLASS_CEFR_CODES,
  ...CLASS_PRIMARY_YEAR_LEVELS,
  ...CLASS_SECONDARY_YEAR_LEVELS,
]);

export function allowedClassLevelsForRubric(rubric: GradeRubricProfile): readonly string[] {
  if (rubric === "language") return CLASS_CEFR_CODES;
  if (rubric === "primary") return CLASS_PRIMARY_YEAR_LEVELS;
  return CLASS_SECONDARY_YEAR_LEVELS;
}

export function isValidClassLevelForRubric(
  level: string | null | undefined,
  rubric: GradeRubricProfile,
): boolean {
  if (level === null || level === undefined || String(level).trim() === "") return true;
  const v = String(level).trim();
  return allowedClassLevelsForRubric(rubric).includes(v);
}

/** Returns a CEFR code only when `raw` is one of A1–C2 (for homework-restriction prompts). */
export function cefrLevelForAiPrompts(raw: string | null | undefined): CefrLevel | null {
  const s = (raw ?? "").trim();
  return CLASS_CEFR_CODES.includes(s as CefrLevel) ? (s as CefrLevel) : null;
}

export function isKnownClassLevelString(raw: string | null | undefined): boolean {
  const s = (raw ?? "").trim();
  return s.length > 0 && ALL_LEVELS.has(s);
}
