import { translate, type UiLang } from "@/lib/i18n/uiStrings";

export type LetterheadContactLayout = "inline" | "stacked";

export type LetterheadContactLabels = {
  phone: string;
  mobile: string;
  email: string;
};

export type LetterheadContactFields = {
  layout: LetterheadContactLayout;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  /** Legacy single-line contact when structured fields are empty. */
  legacyContact?: string | null;
};

function trimOrNull(s: string | null | undefined): string | null {
  const t = (s ?? "").trim();
  return t || null;
}

export function parseLetterheadContactLayout(raw: string | null | undefined): LetterheadContactLayout {
  if (raw === "stacked") return "stacked";
  return "inline";
}

/** Localized word labels for PDF letterhead contact lines. */
export function letterheadContactLabelsForPdf(lang: UiLang): LetterheadContactLabels {
  return {
    phone: translate(lang, "pdf.letterheadContactPhone"),
    mobile: translate(lang, "pdf.letterheadContactMobile"),
    email: translate(lang, "pdf.letterheadContactEmail"),
  };
}

/** Replace legacy symbol prefixes and non-ASCII separators with ASCII spaces. */
export function sanitizeLetterheadContactForPdf(text: string): string {
  let s = text;
  s = s.replace(/[\u260E\u260F\u2706\u2709]/g, ""); // phone/fax/envelope symbols
  s = s.replace(/\u00BB/g, "");
  s = s.replace(/\u00AB/g, "");
  s = s.replace(/\s*\u00B7\s*/g, "  "); // middle dot → spaces (often renders as && in PDF)
  s = s.replace(/\s*\u2022\s*/g, "  "); // bullet
  s = s.replace(/\s*\u2013\s*/g, " - "); // en dash
  s = s.replace(/\s*\u2014\s*/g, " - "); // em dash
  s = s.replace(/\s{3,}/g, "  ");
  return s.trim();
}

/** Build contact block for PDF. Returns null when empty. */
export function formatLetterheadContactForPdf(
  fields: LetterheadContactFields,
  labels: LetterheadContactLabels,
): string | null {
  const phone = trimOrNull(fields.phone);
  const mobile = trimOrNull(fields.mobile);
  const email = trimOrNull(fields.email);

  const parts: string[] = [];
  if (phone) parts.push(`${labels.phone} ${phone}`);
  if (mobile) parts.push(`${labels.mobile} ${mobile}`);
  if (email) parts.push(`${labels.email} ${email}`);

  if (parts.length === 0) {
    const legacy = trimOrNull(fields.legacyContact);
    return legacy ? sanitizeLetterheadContactForPdf(legacy) : null;
  }

  const joined = fields.layout === "stacked" ? parts.join("\n") : parts.join("  ");
  return sanitizeLetterheadContactForPdf(joined);
}
