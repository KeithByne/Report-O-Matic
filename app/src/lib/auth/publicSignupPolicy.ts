import { isStripePaymentsEnabled } from "@/lib/stripe/enabled";

/**
 * When true, `/api/auth/login` rejects `mode: "signup"` for emails that have no
 * membership yet (no self-serve “create a school” from the landing page).
 *
 * - Production default: disabled while card billing is off (`ROM_STRIPE_ENABLED` not `true`),
 *   so new schools only come from the SaaS-owner test-access flow (`?test=…` → Sign in).
 * - Invited staff are unaffected: their email already has a membership row before first sign-in.
 *
 * Overrides:
 * - `ROM_PUBLIC_SCHOOL_SIGNUP=true` — allow open new-school signup (e.g. staging).
 * - `ROM_PUBLIC_SCHOOL_SIGNUP=false` — keep new-school signup closed even when Stripe is enabled.
 * - Non-production: open by default unless `ROM_PUBLIC_SCHOOL_SIGNUP=false`.
 */
export function isPublicSchoolSignupDisabled(): boolean {
  const raw = process.env.ROM_PUBLIC_SCHOOL_SIGNUP?.trim();
  if (raw === "true") return false;
  if (raw === "false") return true;
  if (process.env.NODE_ENV !== "production") return false;
  return !isStripePaymentsEnabled();
}
