import type { SubjectCode } from "@/lib/subjects";
import { CUSTOM_SUBJECT_MAX_LEN, isSubjectCode } from "@/lib/subjects";
import { REPORT_SUBJECT_I18N, subjectLabelLocalized, translate, type UiLang } from "@/lib/i18n/uiStrings";

/**
 * Normalizes subject field text for API/storage: ISO preset codes, or any localized
 * preset label (all UI languages) maps to its code; otherwise treated as a custom name.
 */
export function resolveDefaultSubjectInputToStorage(raw: string, lang?: UiLang): string {
  const t = raw.trim();
  if (!t) throw new Error("Empty subject.");
  const collapsed = t.replace(/\s+/g, " ").trim();
  if (!collapsed) throw new Error("Empty subject.");
  const lower = collapsed.toLowerCase();
  if (lower === "subject to be defined") return "Subject to be Defined";
  if (lang) {
    const undefLab = translate(lang, "class.subjectToBeDefinedLabel").trim().toLowerCase();
    if (undefLab.length > 0 && lower === undefLab) return "Subject to be Defined";
  }
  if (isSubjectCode(lower)) return lower;
  for (const code of Object.keys(REPORT_SUBJECT_I18N) as SubjectCode[]) {
    for (const lab of Object.values(REPORT_SUBJECT_I18N[code])) {
      const n = lab.trim();
      if (n.length > 0 && n.toLowerCase() === lower) return code;
    }
  }
  if (collapsed.length > CUSTOM_SUBJECT_MAX_LEN) throw new Error("Subject too long.");
  return collapsed;
}

/**
 * Text shown in the subject <input> for a stored class default (codes → localized preset titles;
 * legacy unset `Subject to be Defined` → empty so placeholder “Define Subject Name” shows).
 * Sentinel `Subject to be Defined` is also shown empty so the field stays open for datalist / typing
 * (stored value is unchanged until the user saves a real subject).
 */
export function subjectFieldDisplayValueFromStored(raw: unknown, lang: UiLang): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const low = s.toLowerCase();
  if (low === "subject to be defined") return "";
  const undefLab = translate(lang, "class.subjectToBeDefinedLabel").trim().toLowerCase();
  if (undefLab.length > 0 && low === undefLab) return "";
  if (isSubjectCode(low)) return subjectLabelLocalized(lang, low);
  return s;
}

