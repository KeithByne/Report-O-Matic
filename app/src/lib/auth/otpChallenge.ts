import crypto from "node:crypto";
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
  const supabase = getServiceSupabase();
  if (supabase) {
    const expiresAt = new Date(opts.expiresAtMs).toISOString();
    const { error } = await supabase.from("otp_challenges").insert({
      id: opts.challengeId,
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
  store.otps.set(opts.challengeId, {
    challengeId: opts.challengeId,
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
  const supabase = getServiceSupabase();

  if (supabase) {
    const { data: row, error: fetchError } = await supabase
      .from("otp_challenges")
      .select("id, email, code_hash, expires_at, attempts, mode, owner_name, school_name, referral_code, test_access_token")
      .eq("id", opts.challengeId)
      .maybeSingle();

    if (fetchError) return { ok: false, status: 500, message: formatPostgrestError(fetchError) };
    if (!row) return { ok: false, status: 400, message: "Code challenge not found or expired." };

    if (row.email !== opts.email) {
      return { ok: false, status: 400, message: "Email does not match this challenge." };
    }

    const expiresAt = new Date(row.expires_at as string).getTime();
    if (expiresAt <= opts.nowMs) {
      await supabase.from("otp_challenges").delete().eq("id", opts.challengeId);
      return { ok: false, status: 400, message: "Code expired. Please request a new code." };
    }

    const attempts = Number(row.attempts) || 0;
    const nextAttempts = attempts + 1;
    if (nextAttempts > 8) {
      await supabase.from("otp_challenges").delete().eq("id", opts.challengeId);
      return { ok: false, status: 429, message: "Too many incorrect attempts. Please request a new code." };
    }

    const expectedHash = otpCodeHash(opts.challengeId, opts.code, opts.pepper);
    const match = safeEqualHex(expectedHash, row.code_hash as string);

    if (!match) {
      await supabase.from("otp_challenges").update({ attempts: nextAttempts }).eq("id", opts.challengeId);
      return { ok: false, status: 400, message: "Incorrect code." };
    }

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

    await supabase.from("otp_challenges").delete().eq("id", opts.challengeId);
    return { ok: true, mode, ownerName, schoolName, referralCode, testAccessToken };
  }

  const store = getDevStore();
  store.cleanup(opts.nowMs);
  const rec = store.otps.get(opts.challengeId);
  if (!rec) return { ok: false, status: 400, message: "Code challenge not found or expired." };
  if (rec.email !== opts.email) {
    return { ok: false, status: 400, message: "Email does not match this challenge." };
  }
  if (rec.expiresAtMs <= opts.nowMs) {
    store.otps.delete(opts.challengeId);
    return { ok: false, status: 400, message: "Code expired. Please request a new code." };
  }

  rec.attempts += 1;
  if (rec.attempts > 8) {
    store.otps.delete(opts.challengeId);
    return { ok: false, status: 429, message: "Too many incorrect attempts. Please request a new code." };
  }

  const expectedHash = otpCodeHash(opts.challengeId, opts.code, opts.pepper);
  const match = safeEqualHex(expectedHash, rec.codeHash);
  if (!match) {
    store.otps.set(opts.challengeId, rec);
    return { ok: false, status: 400, message: "Incorrect code." };
  }

  const mode = rec.mode;
  const ownerName = rec.ownerName;
  const schoolName = rec.schoolName;
  const referralCode = rec.referralCode ?? null;
  const testAccessToken = rec.testAccessToken ?? null;
  store.otps.delete(opts.challengeId);
  return { ok: true, mode, ownerName, schoolName, referralCode, testAccessToken };
}
