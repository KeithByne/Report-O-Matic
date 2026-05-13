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
 * `crypto.randomUUID()` is lowercase; URLs/clients may send uppercase. Hashing is case-sensitive,
 * so we must match the canonical form used when the challenge was created.
 */
export function normalizeOtpChallengeId(raw: string): string {
  return raw
    .trim()
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, "-")
    .toLowerCase();
}
