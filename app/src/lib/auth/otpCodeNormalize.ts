/**
 * Normalizes pasted / autofill OTP input so it matches what we hash server-side.
 */
export function normalizeOtpCodeInput(raw: string): string {
  let s = raw.trim().replace(/[\u200B-\u200D\uFEFF]/g, "");
  s = s.replace(/[\uFF10-\uFF19]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30));
  return s.replace(/\D/g, "");
}

/**
 * Canonical lowercase hyphenated UUID for hashing and DB id equality.
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
