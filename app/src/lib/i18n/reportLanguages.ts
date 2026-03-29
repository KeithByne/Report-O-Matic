/** Supported report output languages (ISO 639-1). */
export const REPORT_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
] as const;

/** Interface (UI) language options — aligned with supported report output codes. */
export const UI_LOCALE_CODES = ["en", "fr", "es", "de", "it", "pt"] as const;
export type UiLocaleCode = (typeof UI_LOCALE_CODES)[number];

export const UI_LOCALE_LANGUAGES = REPORT_LANGUAGES.filter((x) =>
  (UI_LOCALE_CODES as readonly string[]).includes(x.code),
) as readonly { code: UiLocaleCode; label: string }[];

/** BCP-47 tags for `Date#toLocaleString` etc., aligned with UI locale codes. */
export const UI_LOCALE_BCP47: Record<UiLocaleCode, string> = {
  en: "en-GB",
  fr: "fr-FR",
  es: "es-ES",
  de: "de-DE",
  it: "it-IT",
  pt: "pt-PT",
};

export type ReportLanguageCode = (typeof REPORT_LANGUAGES)[number]["code"];

export function isReportLanguageCode(s: string): s is ReportLanguageCode {
  return REPORT_LANGUAGES.some((x) => x.code === s);
}

export function languageLabel(code: string): string {
  const f = REPORT_LANGUAGES.find((x) => x.code === code);
  return f?.label ?? code;
}
