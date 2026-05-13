/**
 * Resend configuration — **strict contract** (stability over clever parsing):
 *
 * - `RESEND_API_KEY` — non-empty after trim.
 * - `ROM_FROM_EMAIL` — **exactly one plain RFC-style address**, full string match only
 *   (e.g. `security@report-o-matic.online`). No display names, no `<` / `>`, no spaces.
 * - `ROM_FROM_DISPLAY_NAME` — optional; if set, Resend `from` becomes `Name <email>`.
 *
 * If anything is wrong, callers must fail **before** claiming a code was sent.
 */

/** Local-part + domain ASCII only; whole `ROM_FROM_EMAIL` must match this exactly. */
const PLAIN_SENDER_EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

/** True iff `ROM_FROM_EMAIL` is non-empty and matches the strict plain-address contract. */
export function isRomFromEmailFormatValid(): boolean {
  const raw = (process.env.ROM_FROM_EMAIL ?? "").trim();
  if (!raw) return false;
  return PLAIN_SENDER_EMAIL.test(raw);
}

function stripUnsafeDisplayChars(s: string): string {
  return s.replace(/[\r\n<>]/g, "").trim();
}

export type ResendEnvStatus =
  | { ok: true }
  | { ok: false; reason: "missing_api_key" | "missing_from" | "invalid_from" };

export function getResendEnvStatus(): ResendEnvStatus {
  const apiKey = (process.env.RESEND_API_KEY ?? "").trim();
  const raw = (process.env.ROM_FROM_EMAIL ?? "").trim();
  if (!apiKey) return { ok: false, reason: "missing_api_key" };
  if (!raw) return { ok: false, reason: "missing_from" };
  if (!PLAIN_SENDER_EMAIL.test(raw)) return { ok: false, reason: "invalid_from" };
  return { ok: true };
}

export function hasResendEmailConfig(): boolean {
  return getResendEnvStatus().ok;
}

/**
 * Resend `from` header value, or `null` if env does not meet the contract.
 */
export function getResendFromHeader(): string | null {
  if (!hasResendEmailConfig()) return null;
  const email = process.env.ROM_FROM_EMAIL!.trim();
  const display = stripUnsafeDisplayChars(process.env.ROM_FROM_DISPLAY_NAME ?? "");
  if (display.length > 0) return `${display} <${email}>`;
  return email;
}

export function trimResendEnv(): { apiKey: string | null; from: string | null } {
  const apiKey = (process.env.RESEND_API_KEY ?? "").trim();
  const from = getResendFromHeader();
  return { apiKey: apiKey.length > 0 ? apiKey : null, from };
}

const FORMAT_RULE =
  "ROM_FROM_EMAIL must be exactly one plain address, e.g. security@report-o-matic.online (no angle brackets, no display name in that variable). Optional: ROM_FROM_DISPLAY_NAME=Report-O-Matic.";

/** User-visible + ops copy for 503 when Resend env is not usable. */
export function resendMisconfigurationPayload(): { error: string; code: string } {
  const s = getResendEnvStatus();
  if (s.ok) {
    return { error: "Email configuration error.", code: "resend_internal" };
  }
  switch (s.reason) {
    case "missing_api_key":
      return {
        error: `Transactional email is not configured: missing RESEND_API_KEY. ${FORMAT_RULE}`,
        code: "resend_missing_api_key",
      };
    case "missing_from":
      return {
        error: `Transactional email is not configured: missing ROM_FROM_EMAIL. ${FORMAT_RULE}`,
        code: "resend_missing_from",
      };
    case "invalid_from":
      return {
        error: `Transactional email misconfigured: ROM_FROM_EMAIL is not a valid plain sender address. ${FORMAT_RULE}`,
        code: "resend_invalid_from",
      };
    default:
      return { error: `Transactional email misconfigured. ${FORMAT_RULE}`, code: "resend_misconfigured" };
  }
}

/** Appends a short ops hint when Resend indicates domain or API-key issues. */
export function appendResendDomainHint(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes("verify a domain") ||
    m.includes("testing emails") ||
    m.includes("domain is not verified") ||
    m.includes("only send testing")
  ) {
    return `${message} In Resend: verify the domain. In Vercel: ROM_FROM_EMAIL = plain address on that domain; optional ROM_FROM_DISPLAY_NAME.`;
  }
  if (m.includes("invalid") && m.includes("api")) {
    return `${message} Re-copy RESEND_API_KEY from Resend into Vercel (no quotes or spaces).`;
  }
  return message;
}

export function logResendAccepted(logPrefix: string, result: unknown): void {
  if (!result || typeof result !== "object") return;
  const data = "data" in result ? (result as { data?: unknown }).data : undefined;
  if (data && typeof data === "object" && "id" in data) {
    const id = (data as { id?: string }).id;
    if (typeof id === "string" && id.length > 0) {
      console.log(`${logPrefix} Resend accepted email id=${id}`);
    }
  }
}
