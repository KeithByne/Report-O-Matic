/** Short word labels for PDF letterhead contact lines (Helvetica-safe). */
export const LETTERHEAD_CONTACT_LABEL = {
  phone: "Tel:",
  mobile: "Mob:",
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
    return trimOrNull(fields.legacyContact);
  }

  return fields.layout === "stacked" ? parts.join("\n") : parts.join("  \u00B7  ");
}
