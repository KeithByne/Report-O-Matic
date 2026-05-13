/**
 * Normalizes pasted / autofill OTP input so it matches what we hash server-side.
 * Strips zero-width chars, maps fullwidth digits, keeps ASCII digits only.
 */
export function normalizeOtpCodeInput(raw: string): string {
  let s = raw.trim().replace(/[\u200B-\u200D\uFEFF]/g, "");
  s = s.replace(/[\uFF10-\uFF19]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30));
  return s.replace(/\D/g, "");
}

/**
 * `crypto.randomUUID()` is lowercase hyphenated; URLs/clients may send uppercase, unicode dashes,
 * braces, or (via some DB clients) compact 32-hex without hyphens. OTP hashes are case- and
 * punctuation-sensitive, so we must match the canonical hyphenated lowercase UUID used at insert.
 */
export function normalizeOtpChallengeId(raw: string): string {
  let s = raw
    .trim()
    .replace(/^\{/, "")
    .replace(/\}$/, "")
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, "-")
    .toLowerCase();
  const hex = s.replace(/-/g, "");
  if (/^[0-9a-f]{32}$/.test(hex)) {
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }
  return s;
}
