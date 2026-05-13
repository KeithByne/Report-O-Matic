/**
 * Normalizes pasted / autofill OTP input so it matches what we hash server-side.
 * Strips zero-width chars, maps fullwidth digits, keeps ASCII digits only.
 */
export function normalizeOtpCodeInput(raw: string): string {
  let s = raw.trim().replace(/[\u200B-\u200D\uFEFF]/g, "");
  s = s.replace(/[\uFF10-\uFF19]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30));
  return s.replace(/\D/g, "");
}
