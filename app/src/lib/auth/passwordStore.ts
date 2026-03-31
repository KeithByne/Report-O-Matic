import { getServiceSupabase } from "@/lib/supabase/service";
import { getDevStore } from "@/lib/auth/devStore";

function formatPostgrestError(error: { message: string; details?: string | null; hint?: string | null }): string {
  const parts = [error.message, error.details, error.hint].filter((x): x is string => Boolean(x && String(x).trim()));
  return parts.join(" — ") || "Database request failed.";
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

declare global {
  // eslint-disable-next-line no-var -- global dev-only cache
  var __rom_dev_passwords__: Map<string, string> | undefined;
}

function devPasswords(): Map<string, string> {
  if (!globalThis.__rom_dev_passwords__) globalThis.__rom_dev_passwords__ = new Map<string, string>();
  return globalThis.__rom_dev_passwords__;
}

export async function getPasswordHashForEmail(email: string): Promise<string | null> {
  const normalized = normalizeEmail(email);
  const supabase = getServiceSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("auth_passwords")
      .select("password_hash")
      .eq("email", normalized)
      .maybeSingle();
    if (error) throw new Error(formatPostgrestError(error));
    const hash = (data as { password_hash?: string } | null)?.password_hash;
    return typeof hash === "string" && hash.trim() ? hash : null;
  }

  // Dev fallback (non-durable).
  getDevStore(); // keep dev store alive/consistent with other dev flows
  const h = devPasswords().get(normalized);
  return typeof h === "string" && h.trim() ? h : null;
}

/**
 * Set password hash if none exists yet.
 * Returns true if it was created, false if already existed.
 */
export async function setPasswordHashIfMissing(email: string, passwordHash: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  const supabase = getServiceSupabase();
  if (supabase) {
    // Insert and ignore conflict. We don't allow password change here.
    const { error } = await supabase.from("auth_passwords").insert({ email: normalized, password_hash: passwordHash });
    if (!error) return true;
    // 23505 unique violation (email already exists)
    if ((error as { code?: string }).code === "23505" || /duplicate key|unique constraint/i.test(error.message)) {
      return false;
    }
    throw new Error(formatPostgrestError(error));
  }

  getDevStore();
  const map = devPasswords();
  if (map.has(normalized)) return false;
  map.set(normalized, passwordHash);
  return true;
}

/** Overwrite (or create) password hash for password reset. */
export async function setPasswordHash(email: string, passwordHash: string): Promise<void> {
  const normalized = normalizeEmail(email);
  const supabase = getServiceSupabase();
  if (supabase) {
    const { error } = await supabase
      .from("auth_passwords")
      .upsert({ email: normalized, password_hash: passwordHash }, { onConflict: "email" });
    if (error) throw new Error(formatPostgrestError(error));
    return;
  }

  getDevStore();
  devPasswords().set(normalized, passwordHash);
}

