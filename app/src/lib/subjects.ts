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

/** Max length for a user-defined subject name stored on a class (non-built-in code). */
export const CUSTOM_SUBJECT_MAX_LEN = 120;

/**
 * Normalizes class `default_subject` input: built-in codes lowercased, or a validated custom label.
 */
export function normalizeDefaultSubjectForStorage(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  if (isSubjectCode(lower)) return lower;
  if (t.length > CUSTOM_SUBJECT_MAX_LEN) return null;
  if (!/^[\p{L}\p{N}\s.,&'()\-/+]+$/u.test(t)) return null;
  return t;
}
