import { isSubjectCode } from "@/lib/subjects";

/** Drives metric row titles on reports/PDFs and parent-comment tone in AI prompts. */
export const GRADE_RUBRIC_PROFILES = ["language", "primary", "secondary"] as const;
export type GradeRubricProfile = (typeof GRADE_RUBRIC_PROFILES)[number];

export function isGradeRubricProfile(s: string): s is GradeRubricProfile {
  return (GRADE_RUBRIC_PROFILES as readonly string[]).includes(s);
}

export function parseGradeRubricProfile(raw: unknown, fallback: GradeRubricProfile): GradeRubricProfile {
  return typeof raw === "string" && isGradeRubricProfile(raw) ? raw : fallback;
}

/** Preset subject codes always use the language-acquisition rubric. */
export function gradeRubricForClassDefaultSubject(
  defaultSubject: string,
  customRubricByNameLower: ReadonlyMap<string, GradeRubricProfile>,
): GradeRubricProfile {
  const low = defaultSubject.trim().toLowerCase();
  if (!low) return "language";
  if (isSubjectCode(low)) return "language";
  return customRubricByNameLower.get(low) ?? "secondary";
}
