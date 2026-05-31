/** Plain word labels for PDF letterhead contact (Helvetica / WinAnsi safe). */
export const LETTERHEAD_CONTACT_LABEL = {
  phone: "Telephone:",
  mobile: "Mobile:",
  email: "Email:",
} as const;

export type LetterheadContactLayout = "inline" | "stacked";

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

/** Replace legacy symbol prefixes and non-ASCII separators with word labels / ASCII spaces. */
export function sanitizeLetterheadContactForPdf(text: string): string {
  let s = text;
  s = s.replace(/[\u260E\u260F\u2706\u2709]/g, ""); // phone/fax/envelope symbols
  s = s.replace(/\u00BB/g, "Telephone:");
  s = s.replace(/\u00AB/g, "Mobile:");
  s = s.replace(/\s*\u00B7\s*/g, "  "); // middle dot → spaces (often renders as && in PDF)
  s = s.replace(/\s*\u2022\s*/g, "  "); // bullet
  s = s.replace(/\s*\u2013\s*/g, " - "); // en dash
  s = s.replace(/\s*\u2014\s*/g, " - "); // em dash
  s = s.replace(/\s{3,}/g, "  ");
  return s.trim();
}

/** Build contact block for PDF. Returns null when empty. */
export function formatLetterheadContactForPdf(fields: LetterheadContactFields): string | null {
  const phone = trimOrNull(fields.phone);
  const mobile = trimOrNull(fields.mobile);
  const email = trimOrNull(fields.email);

  const parts: string[] = [];
  if (phone) parts.push(`${LETTERHEAD_CONTACT_LABEL.phone} ${phone}`);
  if (mobile) parts.push(`${LETTERHEAD_CONTACT_LABEL.mobile} ${mobile}`);
  if (email) parts.push(`${LETTERHEAD_CONTACT_LABEL.email} ${email}`);

  if (parts.length === 0) {
    const legacy = trimOrNull(fields.legacyContact);
    return legacy ? sanitizeLetterheadContactForPdf(legacy) : null;
  }

  const joined = fields.layout === "stacked" ? parts.join("\n") : parts.join("  ");
  return sanitizeLetterheadContactForPdf(joined);
}
