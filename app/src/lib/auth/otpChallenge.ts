import crypto from "node:crypto";
import { normalizeOtpChallengeId, normalizeOtpCodeInput } from "@/lib/auth/otpCodeNormalize";
import { getServiceSupabase } from "@/lib/supabase/service";
import { getDevStore, safeEqualHex, sha256Hex } from "@/lib/auth/devStore";

function formatPostgrestError(error: {
  message: string;
  details?: string | null;
  hint?: string | null;
}): string {
  const parts = [error.message, error.details, error.hint].filter(
    (x): x is string => Boolean(x && String(x).trim()),
  );
  let msg = parts.join(" — ") || "Database request failed.";
  if (/row-level security|\brls\b|violates row-level security|permission denied for table/i.test(msg)) {
    msg +=
      " Use SUPABASE_SERVICE_ROLE_KEY from Supabase → Project Settings → API (the service_role secret), not the anon key.";
  }
  return msg;
}

export function isSupabaseOtpEnabled(): boolean {
  return Boolean(getServiceSupabase());
}

export function newChallengeId(): string {
  return crypto.randomUUID();
}

export function otpCodeHash(challengeId: string, code: string, pepper: string): string {
  return sha256Hex(`${pepper}:${challengeId}:${code}`);
}

export async function saveOtpChallenge(opts: {
  challengeId: string;
  email: string;
  codeHash: string;
  expiresAtMs: number;
  mode: "signin" | "signup";
  ownerName?: string | null;
  schoolName?: string | null;
  referralCode?: string | null;
  testAccessToken?: string | null;
}): Promise<void> {
  const challengeKey = normalizeOtpChallengeId(opts.challengeId);
  const supabase = getServiceSupabase();
  if (supabase) {
    const expiresAt = new Date(opts.expiresAtMs).toISOString();
    const { error } = await supabase.from("otp_challenges").insert({
      id: challengeKey,
      email: opts.email,
      code_hash: opts.codeHash,
      expires_at: expiresAt,
      mode: opts.mode,
      attempts: 0,
      owner_name: opts.ownerName ?? null,
      school_name: opts.schoolName ?? null,
      referral_code: opts.referralCode ?? null,
      test_access_token: opts.testAccessToken ?? null,
    });
    if (error) throw new Error(formatPostgrestError(error));
    return;
  }

  const store = getDevStore();
  const nowMs = Date.now();
  store.otps.set(challengeKey, {
    challengeId: challengeKey,
    email: opts.email,
    codeHash: opts.codeHash,
    expiresAtMs: opts.expiresAtMs,
    createdAtMs: nowMs,
    mode: opts.mode,
    ownerName: opts.ownerName ?? null,
    schoolName: opts.schoolName ?? null,
    referralCode: opts.referralCode ?? null,
    testAccessToken: opts.testAccessToken ?? null,
    attempts: 0,
  });
}

/** Remove any in-flight OTP rows for this account so a new code is the only valid one. */
export async function purgePriorOtpChallengesForEmail(email: string, nowMs: number): Promise<void> {
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

export type VerifyOtpResult =
  | {
      ok: true;
      mode: "signin" | "signup";
      ownerName: string | null;
      schoolName: string | null;
      referralCode: string | null;
      testAccessToken: string | null;
    }
  | { ok: false; status: number; message: string };

export async function verifyOtpChallenge(opts: {
  challengeId: string;
  email: string;
  code: string;
  pepper: string;
  nowMs: number;
}): Promise<VerifyOtpResult> {
  const challengeId = normalizeOtpChallengeId(opts.challengeId);
  const code = normalizeOtpCodeInput(opts.code);
  const emailNorm = String(opts.email || "").trim().toLowerCase();
  const supabase = getServiceSupabase();

  if (supabase) {
    const isoNow = new Date(opts.nowMs).toISOString();

    const clearOtpForEmail = async () => {
      await supabase.from("otp_challenges").delete().eq("email", emailNorm);
    };

    const rowMatchesCode = (r: {
      id: unknown;
      code_hash: unknown;
    }): boolean => {
      const idCanon = normalizeOtpChallengeId(String(r.id));
      const stored = String(r.code_hash ?? "").trim();
      return safeEqualHex(otpCodeHash(idCanon, code, opts.pepper), stored);
    };

    const mapSuccess = (row: {
      mode: unknown;
      owner_name?: unknown;
      school_name?: unknown;
      referral_code?: unknown;
      test_access_token?: unknown;
    }): Extract<VerifyOtpResult, { ok: true }> => {
      const mode = row.mode === "signup" ? "signup" : "signin";
      const ownerName =
        typeof row.owner_name === "string" && row.owner_name.trim() ? row.owner_name.trim() : null;
      const schoolName =
        typeof row.school_name === "string" && row.school_name.trim() ? row.school_name.trim() : null;
      const referralCode =
        typeof row.referral_code === "string" && row.referral_code.trim() ? row.referral_code.trim() : null;
      const testAccessToken =
        typeof (row as any).test_access_token === "string" && String((row as any).test_access_token).trim()
          ? String((row as any).test_access_token).trim()
          : null;
      return { ok: true, mode, ownerName, schoolName, referralCode, testAccessToken };
    };

    const loadActiveForEmail = async (): Promise<
      | { ok: false; message: string }
      | {
          ok: true;
          rows: Array<{
            id: string;
            email: string;
            code_hash: string;
            expires_at: string;
            attempts: number;
            mode: string;
            owner_name: string | null;
            school_name: string | null;
            referral_code: string | null;
            test_access_token: string | null;
          }>;
        }
    > => {
      const { data, error } = await supabase
        .from("otp_challenges")
        .select(
          "id, email, code_hash, expires_at, attempts, mode, owner_name, school_name, referral_code, test_access_token",
        )
        .eq("email", emailNorm)
        .gt("expires_at", isoNow);
      if (error) return { ok: false, message: formatPostgrestError(error) };
      return { ok: true, rows: (data ?? []) as any[] };
    };

    const { data: row, error: fetchError } = await supabase
      .from("otp_challenges")
      .select("id, email, code_hash, expires_at, attempts, mode, owner_name, school_name, referral_code, test_access_token")
      .eq("id", challengeId)
      .maybeSingle();

    if (fetchError) return { ok: false, status: 500, message: formatPostgrestError(fetchError) };

    const tryUniqueEmailFallback = async (): Promise<VerifyOtpResult | null> => {
      const loaded = await loadActiveForEmail();
      if (!loaded.ok) return { ok: false, status: 500, message: loaded.message };
      const hits = loaded.rows.filter((r) => rowMatchesCode(r));
      if (hits.length === 1) {
        const ok = mapSuccess(hits[0]!);
        await clearOtpForEmail();
        return ok;
      }
      if (hits.length > 1) {
        return {
          ok: false,
          status: 400,
          message:
            "Multiple active sign-in codes for this email. Request a new code and open the latest link from your inbox.",
        };
      }
      return null;
    };

    if (row) {
      if (String(row.email || "").trim().toLowerCase() !== emailNorm) {
        return { ok: false, status: 400, message: "Email does not match this challenge." };
      }

      const expiresAt = new Date(row.expires_at as string).getTime();
      if (expiresAt <= opts.nowMs) {
        await supabase.from("otp_challenges").delete().eq("id", row.id);
        return { ok: false, status: 400, message: "Code expired. Please request a new code." };
      }

      if (rowMatchesCode(row)) {
        const ok = mapSuccess(row);
        await clearOtpForEmail();
        return ok;
      }

      const attempts = Number(row.attempts) || 0;
      const nextAttempts = attempts + 1;
      if (nextAttempts > 8) {
        await clearOtpForEmail();
        return { ok: false, status: 429, message: "Too many incorrect attempts. Please request a new code." };
      }

      const fb = await tryUniqueEmailFallback();
      if (fb !== null) return fb;

      await supabase.from("otp_challenges").update({ attempts: nextAttempts }).eq("id", row.id);
      return { ok: false, status: 400, message: "Incorrect code." };
    }

    const fb = await tryUniqueEmailFallback();
    if (fb !== null) return fb;

    return { ok: false, status: 400, message: "Code challenge not found or expired." };
  }

  const store = getDevStore();
  store.cleanup(opts.nowMs);
  const rec = store.otps.get(challengeId);
  if (!rec) return { ok: false, status: 400, message: "Code challenge not found or expired." };
  if (String(rec.email || "").trim().toLowerCase() !== emailNorm) {
    return { ok: false, status: 400, message: "Email does not match this challenge." };
  }
  if (rec.expiresAtMs <= opts.nowMs) {
    store.otps.delete(challengeId);
    return { ok: false, status: 400, message: "Code expired. Please request a new code." };
  }

  rec.attempts += 1;
  if (rec.attempts > 8) {
    store.otps.delete(challengeId);
    return { ok: false, status: 429, message: "Too many incorrect attempts. Please request a new code." };
  }

  const expectedHash = otpCodeHash(challengeId, code, opts.pepper);
  const match = safeEqualHex(expectedHash, String(rec.codeHash ?? "").trim());
  if (!match) {
    store.otps.set(challengeId, rec);
    return { ok: false, status: 400, message: "Incorrect code." };
  }

  const mode = rec.mode;
  const ownerName = rec.ownerName;
  const schoolName = rec.schoolName;
  const referralCode = rec.referralCode ?? null;
  const testAccessToken = rec.testAccessToken ?? null;
  store.otps.delete(challengeId);
  return { ok: true, mode, ownerName, schoolName, referralCode, testAccessToken };
}

/** Load an active OTP challenge for backup resend (does not consume the challenge). */
export async function readActiveOtpChallengeForResend(opts: {
  challengeId: string;
  nowMs: number;
}): Promise<
  | { ok: true; email: string; mode: "signin" | "signup" }
  | { ok: false; status: number; message: string }
> {
  const challengeId = normalizeOtpChallengeId(opts.challengeId);
  const supabase = getServiceSupabase();
  if (supabase) {
    const { data: row, error: fetchError } = await supabase
      .from("otp_challenges")
      .select("id, email, expires_at, mode")
      .eq("id", challengeId)
      .maybeSingle();
    if (fetchError) return { ok: false, status: 500, message: formatPostgrestError(fetchError) };
    if (!row) return { ok: false, status: 400, message: "Code challenge not found or expired." };
    const expiresAt = new Date(row.expires_at as string).getTime();
    if (expiresAt <= opts.nowMs) {
      await supabase.from("otp_challenges").delete().eq("id", challengeId);
      return { ok: false, status: 400, message: "Code expired. Please request a new code." };
    }
    const email = String(row.email || "").trim().toLowerCase();
    const mode = row.mode === "signup" ? "signup" : "signin";
    return { ok: true, email, mode };
  }

  const store = getDevStore();
  store.cleanup(opts.nowMs);
  const rec = store.otps.get(challengeId);
  if (!rec) return { ok: false, status: 400, message: "Code challenge not found or expired." };
  if (rec.expiresAtMs <= opts.nowMs) {
    store.otps.delete(challengeId);
    return { ok: false, status: 400, message: "Code expired. Please request a new code." };
  }
  return { ok: true, email: rec.email.trim().toLowerCase(), mode: rec.mode };
}

/** Replace OTP hash and expiry (used when sending a fresh code to a backup inbox). */
export async function rotateOtpChallengeCode(opts: {
  challengeId: string;
  email: string;
  codeHash: string;
  expiresAtMs: number;
  nowMs: number;
}): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const challengeId = normalizeOtpChallengeId(opts.challengeId);
  const emailNorm = String(opts.email || "").trim().toLowerCase();
  const supabase = getServiceSupabase();
  if (supabase) {
    const { data: row, error: fetchError } = await supabase
      .from("otp_challenges")
      .select("id, email, expires_at")
      .eq("id", challengeId)
      .maybeSingle();
    if (fetchError) return { ok: false, status: 500, message: formatPostgrestError(fetchError) };
    if (!row) return { ok: false, status: 400, message: "Code challenge not found or expired." };
    const rowEmail = String(row.email || "").trim().toLowerCase();
    if (rowEmail !== emailNorm) {
      return { ok: false, status: 400, message: "Email does not match this challenge." };
    }
    const expiresAt = new Date(row.expires_at as string).getTime();
    if (expiresAt <= opts.nowMs) {
      await supabase.from("otp_challenges").delete().eq("id", challengeId);
      return { ok: false, status: 400, message: "Code expired. Please request a new code." };
    }
    const { data: updated, error: upErr } = await supabase
      .from("otp_challenges")
      .update({
        code_hash: opts.codeHash,
        expires_at: new Date(opts.expiresAtMs).toISOString(),
        attempts: 0,
      })
      .eq("id", challengeId)
      .eq("email", emailNorm)
      .select("id")
      .maybeSingle();
    if (upErr) return { ok: false, status: 500, message: formatPostgrestError(upErr) };
    if (!updated) return { ok: false, status: 400, message: "Code challenge not found or expired." };
    return { ok: true };
  }

  const store = getDevStore();
  store.cleanup(opts.nowMs);
  const rec = store.otps.get(challengeId);
  if (!rec) return { ok: false, status: 400, message: "Code challenge not found or expired." };
  if (rec.email.trim().toLowerCase() !== emailNorm) {
    return { ok: false, status: 400, message: "Email does not match this challenge." };
  }
  if (rec.expiresAtMs <= opts.nowMs) {
    store.otps.delete(challengeId);
    return { ok: false, status: 400, message: "Code expired. Please request a new code." };
  }
  rec.codeHash = opts.codeHash;
  rec.expiresAtMs = opts.expiresAtMs;
  rec.attempts = 0;
  store.otps.set(challengeId, rec);
  return { ok: true };
}
