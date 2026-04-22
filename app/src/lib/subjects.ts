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

/** Max length for a custom (non-preset) subject name stored on a class. */
export const CUSTOM_SUBJECT_MAX_LEN = 120;

/**
 * Normalizes a class default subject for storage: preset codes lowercased;
 * custom names trimmed with collapsed whitespace and length capped.
 */
export function normalizeDefaultSubjectForStorage(raw: string): string {
  const t = raw.trim();
  if (!t) throw new Error("Empty subject.");
  const lower = t.toLowerCase();
  if (isSubjectCode(lower)) return lower;
  const collapsed = t.replace(/\s+/g, " ").trim();
  if (!collapsed) throw new Error("Empty subject.");
  if (collapsed.length > CUSTOM_SUBJECT_MAX_LEN) throw new Error("Subject too long.");
  return collapsed;
}

/** Safe coercion when reading legacy or invalid DB values. */
export function coerceStoredDefaultSubject(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "efl";
  try {
    return normalizeDefaultSubjectForStorage(s);
  } catch {
    return "efl";
  }
}

