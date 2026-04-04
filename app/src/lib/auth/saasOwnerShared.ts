/**
 * Client-safe SaaS-owner checks (no `next/server` or `next/headers`).
 * Import this from Client Components; use `saasOwner.ts` only on the server for `requireSaasOwner`.
 */

function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

/** Obfuscated app path (see `app/saas-owner/page.tsx`). */
export const SAAS_OWNER_DASHBOARD_PATH = "/saas-owner/Jane2788Eyre" as const;

/** Always treated as SaaS owner in addition to `ROM_SAAS_OWNER_EMAILS`. */
const DEFAULT_SAAS_OWNER_EMAILS = ["keith.byne@hotmail.co.uk"];

export function isSaasOwnerEmail(email: string): boolean {
  const n = normalizeEmail(email);
  if (DEFAULT_SAAS_OWNER_EMAILS.includes(n)) return true;
  const allow = process.env.ROM_SAAS_OWNER_EMAILS ?? "";
  const list = allow
    .split(",")
    .map((x) => normalizeEmail(x))
    .filter(Boolean);
  if (list.length === 0) return false;
  return list.includes(n);
}

/** After OTP verify (and similar), SaaS owners skip the school dashboard. */
export function postSignInRedirectPath(email: string): string {
  return isSaasOwnerEmail(email) ? SAAS_OWNER_DASHBOARD_PATH : "/dashboard";
}
