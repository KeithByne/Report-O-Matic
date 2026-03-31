import crypto from "node:crypto";
import { getServiceSupabase } from "@/lib/supabase/service";
import { getDevStore, safeEqualHex, sha256Hex } from "@/lib/auth/devStore";

function formatPostgrestError(error: { message: string; details?: string | null; hint?: string | null }): string {
  const parts = [error.message, error.details, error.hint].filter((x): x is string => Boolean(x && String(x).trim()));
  let msg = parts.join(" — ") || "Database request failed.";
  if (/row-level security|\brls\b|violates row level security|permission denied for table/i.test(msg)) {
    msg +=
      " Use SUPABASE_SERVICE_ROLE_KEY from Supabase → Project Settings → API (the service_role secret), not the anon key.";
  }
  return msg;
}

export function newResetChallengeId(): string {
  return crypto.randomUUID();
}

export function resetCodeHash(challengeId: string, code: string, pepper: string): string {
  return sha256Hex(`${pepper}:${challengeId}:${code}`);
}

export async function savePasswordResetChallenge(opts: {
  challengeId: string;
  email: string;
  codeHash: string;
  expiresAtMs: number;
}): Promise<void> {
  const supabase = getServiceSupabase();
  if (supabase) {
    const expiresAt = new Date(opts.expiresAtMs).toISOString();
    const { error } = await supabase.from("password_reset_challenges").insert({
      id: opts.challengeId,
      email: opts.email,
      code_hash: opts.codeHash,
      expires_at: expiresAt,
      attempts: 0,
    });
    if (error) throw new Error(formatPostgrestError(error));
    return;
  }

  const store = getDevStore();
  const nowMs = Date.now();
  // Dev store piggyback: use separate map key namespace under otps
  store.otps.set(`reset:${opts.challengeId}`, {
    challengeId: opts.challengeId,
    email: opts.email,
    codeHash: opts.codeHash,
    expiresAtMs: opts.expiresAtMs,
    createdAtMs: nowMs,
    mode: "signin",
    ownerName: null,
    schoolName: null,
    attempts: 0,
  });
}

export type VerifyResetResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

export async function verifyPasswordResetChallenge(opts: {
  challengeId: string;
  email: string;
  code: string;
  pepper: string;
  nowMs: number;
}): Promise<VerifyResetResult> {
  const supabase = getServiceSupabase();
  if (supabase) {
    const { data: row, error: fetchError } = await supabase
      .from("password_reset_challenges")
      .select("id, email, code_hash, expires_at, attempts")
      .eq("id", opts.challengeId)
      .maybeSingle();
    if (fetchError) return { ok: false, status: 500, message: formatPostgrestError(fetchError) };
    if (!row) return { ok: false, status: 400, message: "Reset challenge not found or expired." };
    if (row.email !== opts.email) return { ok: false, status: 400, message: "Email does not match this reset challenge." };

    const expiresAt = new Date(row.expires_at as string).getTime();
    if (expiresAt <= opts.nowMs) {
      await supabase.from("password_reset_challenges").delete().eq("id", opts.challengeId);
      return { ok: false, status: 400, message: "Reset code expired. Please request a new one." };
    }

    const attempts = Number(row.attempts) || 0;
    const nextAttempts = attempts + 1;
    if (nextAttempts > 8) {
      await supabase.from("password_reset_challenges").delete().eq("id", opts.challengeId);
      return { ok: false, status: 429, message: "Too many incorrect attempts. Please request a new reset code." };
    }

    const expectedHash = resetCodeHash(opts.challengeId, opts.code, opts.pepper);
    const match = safeEqualHex(expectedHash, row.code_hash as string);
    if (!match) {
      await supabase.from("password_reset_challenges").update({ attempts: nextAttempts }).eq("id", opts.challengeId);
      return { ok: false, status: 400, message: "Incorrect reset code." };
    }

    await supabase.from("password_reset_challenges").delete().eq("id", opts.challengeId);
    return { ok: true };
  }

  const store = getDevStore();
  store.cleanup(opts.nowMs);
  const key = `reset:${opts.challengeId}`;
  const rec = store.otps.get(key);
  if (!rec) return { ok: false, status: 400, message: "Reset challenge not found or expired." };
  if (rec.email !== opts.email) return { ok: false, status: 400, message: "Email does not match this reset challenge." };
  if (rec.expiresAtMs <= opts.nowMs) {
    store.otps.delete(key);
    return { ok: false, status: 400, message: "Reset code expired. Please request a new one." };
  }
  rec.attempts += 1;
  if (rec.attempts > 8) {
    store.otps.delete(key);
    return { ok: false, status: 429, message: "Too many incorrect attempts. Please request a new reset code." };
  }
  const expectedHash = resetCodeHash(opts.challengeId, opts.code, opts.pepper);
  const match = safeEqualHex(expectedHash, rec.codeHash);
  if (!match) {
    store.otps.set(key, rec);
    return { ok: false, status: 400, message: "Incorrect reset code." };
  }
  store.otps.delete(key);
  return { ok: true };
}

