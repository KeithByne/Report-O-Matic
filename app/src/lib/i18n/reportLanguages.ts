/**
 * Supported report output / PDF / OpenAI parent-comment languages (single ordered list for UI + API).
 *
 * Note: Full UI copy lives in `uiStrings.ts`. Locales `nl`, `pl`, `ro`, `ru`, `uk`, `ar` intentionally
 * mirror English strings until dedicated bundles exist. `fr`/`es` override many keys; anything not listed
 * there stays English. Language *names* in dropdowns use `reportLanguageOptionLabel` (Intl / CLDR).
 */
export const REPORT_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "it", label: "Italian" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "nl", label: "Dutch" },
  { code: "pl", label: "Polish" },
  { code: "ro", label: "Romanian" },
  { code: "ru", label: "Russian" },
  { code: "uk", label: "Ukrainian" },
  { code: "ar", label: "Arabic" },
] as const;

/** Interface language codes — same set and order as report/PDF languages. */
export const UI_LOCALE_CODES = [
  "en",
  "es",
  "fr",
  "it",
  "de",
  "pt",
  "nl",
  "pl",
  "ro",
  "ru",
  "uk",
  "ar",
] as const;
export type UiLocaleCode = (typeof UI_LOCALE_CODES)[number];

export const UI_LOCALE_LANGUAGES = REPORT_LANGUAGES;

/** BCP-47 tags for `Date#toLocaleString` etc. */
export const UI_LOCALE_BCP47: Record<UiLocaleCode, string> = {
  en: "en-GB",
  es: "es-ES",
  fr: "fr-FR",
  it: "it-IT",
  de: "de-DE",
  pt: "pt-PT",
  nl: "nl-NL",
  pl: "pl-PL",
  ro: "ro-RO",
  ru: "ru-RU",
  uk: "uk-UA",
  ar: "ar",
};

export type ReportLanguageCode = (typeof REPORT_LANGUAGES)[number]["code"];

export function isReportLanguageCode(s: string): s is ReportLanguageCode {
  return REPORT_LANGUAGES.some((x) => x.code === s);
}

export function languageLabel(code: string): string {
  const f = REPORT_LANGUAGES.find((x) => x.code === code);
  return f?.label ?? code;
}
