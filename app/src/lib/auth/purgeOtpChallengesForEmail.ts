import { getDevStore } from "@/lib/auth/devStore";
import { getServiceSupabase } from "@/lib/supabase/service";

function formatPostgrestError(error: { message: string; details?: string | null; hint?: string | null }): string {
  const parts = [error.message, error.details, error.hint].filter(
    (x): x is string => Boolean(x && String(x).trim()),
  );
  return parts.join(" — ") || "Database request failed.";
}

/** Best-effort cleanup of legacy email-OTP rows after password login. */
export async function purgeOtpChallengesForEmail(email: string, nowMs: number): Promise<void> {
  const emailNorm = String(email || "").trim().toLowerCase();
  const supabase = getServiceSupabase();
  if (supabase) {
    const { error } = await supabase.from("otp_challenges").delete().eq("email", emailNorm);
    if (error) throw new Error(formatPostgrestError(error));
    return;
  }
  const store = getDevStore();
  store.cleanup(nowMs);
  for (const [k, v] of store.otps.entries()) {
    if (String(v.email || "").trim().toLowerCase() === emailNorm) store.otps.delete(k);
  }
}
