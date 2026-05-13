import crypto from "node:crypto";
import { normalizeOtpChallengeId, normalizeOtpCodeInput } from "@/lib/auth/otpCodeNormalize";
import { getServiceSupabase } from "@/lib/supabase/service";
import { getDevStore, safeEqualHex, sha256Hex } from "@/lib/auth/devStore";

function formatPostgrestError(error: { message: string; details?: string | null; hint?: string | null }): string {
  const parts = [error.message, error.details, error.hint].filter(
    (x): x is string => Boolean(x && String(x).trim()),
  );
  return parts.join(" — ") || "Database request failed.";
}

export function signinOtpCodeHash(challengeId: string, code: string, pepper: string): string {
  return sha256Hex(`${pepper}:${challengeId}:${code}`);
}

export function randomSixDigitCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < 6; i++) out += String(bytes[i] % 10);
  return out;
}

export function getSigninOtpTtlMs(): number {
  const raw = process.env.ROM_SIGNIN_OTP_TTL_SECONDS?.trim() ?? process.env.ROM_OTP_TTL_SECONDS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 60 && n <= 3600) return n * 1000;
  }
  return process.env.NODE_ENV === "production" ? 180_000 : 600_000;
}

export async function saveSigninOtpChallenge(opts: {
  challengeId: string;
  email: string;
  codeHash: string;
  expiresAtMs: number;
  testAccessToken: string | null;
}): Promise<void> {
  const challengeKey = normalizeOtpChallengeId(opts.challengeId);
  const emailNorm = String(opts.email || "").trim().toLowerCase();
  const supabase = getServiceSupabase();
  if (supabase) {
    const expiresAt = new Date(opts.expiresAtMs).toISOString();
    const { error } = await supabase.from("otp_challenges").insert({
      id: challengeKey,
      email: emailNorm,
      code_hash: opts.codeHash,
      expires_at: expiresAt,
      mode: "signin",
      attempts: 0,
      owner_name: null,
      school_name: null,
      referral_code: null,
      test_access_token: opts.testAccessToken,
    });
    if (error) throw new Error(formatPostgrestError(error));
    return;
  }

  const store = getDevStore();
  const nowMs = Date.now();
  store.cleanup(nowMs);
  store.otps.set(challengeKey, {
    challengeId: challengeKey,
    email: emailNorm,
    codeHash: opts.codeHash,
    expiresAtMs: opts.expiresAtMs,
    createdAtMs: nowMs,
    mode: "signin",
    ownerName: null,
    schoolName: null,
    referralCode: null,
    testAccessToken: opts.testAccessToken,
    attempts: 0,
  });
}

export type VerifySigninOtpResult =
  | { ok: true; email: string; testAccessToken: string | null }
  | { ok: false; status: number; message: string };

export async function verifySigninOtpChallenge(opts: {
  challengeId: string;
  email: string;
  code: string;
  pepper: string;
  nowMs: number;
}): Promise<VerifySigninOtpResult> {
  const challengeId = normalizeOtpChallengeId(opts.challengeId);
  const code = normalizeOtpCodeInput(opts.code);
  const emailNorm = String(opts.email || "").trim().toLowerCase();
  const supabase = getServiceSupabase();

  const hashOk = (rowId: unknown, storedHash: unknown): boolean => {
    const idCanon = normalizeOtpChallengeId(String(rowId));
    const stored = String(storedHash ?? "").trim();
    return safeEqualHex(signinOtpCodeHash(idCanon, code, opts.pepper), stored);
  };

  if (supabase) {
    const { data: row, error: fetchError } = await supabase
      .from("otp_challenges")
      .select("id, email, code_hash, expires_at, attempts, test_access_token")
      .eq("id", challengeId)
      .maybeSingle();
    if (fetchError) return { ok: false, status: 500, message: formatPostgrestError(fetchError) };

    if (!row) {
      const { data: rows, error: listErr } = await supabase
        .from("otp_challenges")
        .select("id, email, code_hash, expires_at, attempts, test_access_token")
        .eq("email", emailNorm)
        .gt("expires_at", new Date(opts.nowMs).toISOString());
      if (listErr) return { ok: false, status: 500, message: formatPostgrestError(listErr) };
      const hits = (rows ?? []).filter((r) => hashOk(r.id, r.code_hash));
      if (hits.length === 0) {
        return { ok: false, status: 400, message: "Incorrect or expired code." };
      }
      if (hits.length > 1) {
        return {
          ok: false,
          status: 400,
          message: "Multiple active codes for this email. Request a new code from the landing page.",
        };
      }
      const hit = hits[0] as {
        id: string;
        test_access_token: string | null;
      };
      const testAccessToken =
        typeof hit.test_access_token === "string" && hit.test_access_token.trim()
          ? hit.test_access_token.trim()
          : null;
      await supabase.from("otp_challenges").delete().eq("id", hit.id);
      return { ok: true, email: emailNorm, testAccessToken };
    }

    if (String(row.email || "").trim().toLowerCase() !== emailNorm) {
      return { ok: false, status: 400, message: "Email does not match this sign-in request." };
    }
    const expiresAt = new Date(row.expires_at as string).getTime();
    if (expiresAt <= opts.nowMs) {
      await supabase.from("otp_challenges").delete().eq("id", row.id);
      return { ok: false, status: 400, message: "Code expired. Please sign in again from the landing page." };
    }

    if (hashOk(row.id, row.code_hash)) {
      const testAccessToken =
        typeof (row as { test_access_token?: unknown }).test_access_token === "string" &&
        String((row as { test_access_token: string }).test_access_token).trim()
          ? String((row as { test_access_token: string }).test_access_token).trim()
          : null;
      await supabase.from("otp_challenges").delete().eq("email", emailNorm);
      return { ok: true, email: emailNorm, testAccessToken };
    }

    const attempts = Number(row.attempts) || 0;
    const next = attempts + 1;
    if (next > 8) {
      await supabase.from("otp_challenges").delete().eq("id", row.id);
      return { ok: false, status: 429, message: "Too many incorrect attempts. Please sign in again from the landing page." };
    }
    await supabase.from("otp_challenges").update({ attempts: next }).eq("id", row.id);
    return { ok: false, status: 400, message: "Incorrect code." };
  }

  const store = getDevStore();
  store.cleanup(opts.nowMs);
  const rec = store.otps.get(challengeId);
  if (!rec || rec.mode !== "signin") {
    return { ok: false, status: 400, message: "Incorrect or expired code." };
  }
  if (String(rec.email || "").trim().toLowerCase() !== emailNorm) {
    return { ok: false, status: 400, message: "Email does not match this sign-in request." };
  }
  if (rec.expiresAtMs <= opts.nowMs) {
    store.otps.delete(challengeId);
    return { ok: false, status: 400, message: "Code expired. Please sign in again from the landing page." };
  }
  if (!hashOk(rec.challengeId, rec.codeHash)) {
    rec.attempts += 1;
    if (rec.attempts > 8) {
      store.otps.delete(challengeId);
      return { ok: false, status: 429, message: "Too many incorrect attempts. Please sign in again from the landing page." };
    }
    store.otps.set(challengeId, rec);
    return { ok: false, status: 400, message: "Incorrect code." };
  }
  const testTok = rec.testAccessToken ?? null;
  for (const [k, v] of [...store.otps.entries()]) {
    if (v.mode === "signin" && String(v.email || "").trim().toLowerCase() === emailNorm) store.otps.delete(k);
  }
  return { ok: true, email: emailNorm, testAccessToken: testTok };
}
