/** Curricula / report subjects (expandable). Codes stored on classes + report overrides. */
export const REPORT_SUBJECTS = [
  { code: "efl", label: "English as a Foreign Language" },
  { code: "ffl", label: "French as a Foreign Language" },
  { code: "sfl", label: "Spanish as a Foreign Language" },
  { code: "ifl", label: "Italian as a Foreign Language" },
  { code: "pfl", label: "Portuguese as a Foreign Language" },
] as const;

export type SubjectCode = (typeof REPORT_SUBJECTS)[number]["code"];

export function isSubjectCode(s: string): s is SubjectCode {
  return REPORT_SUBJECTS.some((x) => x.code === s);
}

export function subjectLabel(code: string): string {
  return REPORT_SUBJECTS.find((x) => x.code === code)?.label ?? code;
}
