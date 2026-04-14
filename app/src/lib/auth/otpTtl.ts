/** OTP lifetime. Set `ROM_OTP_TTL_SECONDS` in env to override (allowed 60–3600 seconds). */
export function getOtpTtlMs(): number {
  const raw = process.env.ROM_OTP_TTL_SECONDS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 60 && n <= 3600) return n * 1000;
  }
  return process.env.NODE_ENV === "production" ? 180_000 : 600_000;
}
