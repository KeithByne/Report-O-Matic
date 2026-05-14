import { getPasswordHashForEmail } from "@/lib/auth/passwordStore";
import { getServiceSupabase } from "@/lib/supabase/service";

function formatErr(e: { message: string; details?: string | null; hint?: string | null }): string {
  const parts = [e.message, e.details, e.hint].filter((x): x is string => Boolean(x && String(x).trim()));
  return parts.join(" — ") || "Database error.";
}

function norm(email: string): string {
  return email.trim().toLowerCase();
}

/** Shown on login / sign-up / password reset when this email is cancelled and not yet cleared by SaaS owner. */
export const REACCESS_PENDING_USER_MESSAGE =
  "Your account access is under consideration. Please wait for a response from Report-O-Matic.";

export type CancellationSnapshot = {
  memberships: number;
  had_password: boolean;
};

export async function getSignInSnapshotForEmail(email: string): Promise<CancellationSnapshot> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database is not configured.");
  const e = norm(email);
  const { count, error } = await supabase
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("user_email", e);
  if (error) throw new Error(formatErr(error));
  const had_password = !!(await getPasswordHashForEmail(e));
  return { memberships: count ?? 0, had_password };
}

export async function recordCancelledUser(opts: {
  email: string;
  source: "self" | "saas_owner";
  cancelledByEmail: string | null;
  snapshot: CancellationSnapshot;
}): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database is not configured.");
  const email = norm(opts.email);
  const nowIso = new Date().toISOString();
  const { error } = await supabase.from("cancelled_users").upsert(
    {
      email,
      cancelled_at: nowIso,
      cancelled_by_email: opts.cancelledByEmail ? norm(opts.cancelledByEmail) : null,
      source: opts.source,
      snapshot: opts.snapshot,
      reaccess_blocked: true,
      reaccess_attempt_count: 0,
      last_reaccess_attempt_at: null,
    },
    { onConflict: "email" },
  );
  if (error) throw new Error(formatErr(error));
}

/**
 * If this email is on the cancelled list and still blocked, bump attempt counters and return true.
 * Otherwise return false (caller continues normal auth).
 */
export async function touchIfReaccessBlocked(email: string): Promise<boolean> {
  const supabase = getServiceSupabase();
  if (!supabase) return false;
  const e = norm(email);
  const { data: row, error: selErr } = await supabase
    .from("cancelled_users")
    .select("email, reaccess_blocked, reaccess_attempt_count")
    .eq("email", e)
    .maybeSingle();
  if (selErr) throw new Error(formatErr(selErr));
  if (!row || !(row as { reaccess_blocked?: boolean }).reaccess_blocked) return false;

  const prev = Number((row as { reaccess_attempt_count?: number }).reaccess_attempt_count ?? 0);
  const { error: upErr } = await supabase
    .from("cancelled_users")
    .update({
      last_reaccess_attempt_at: new Date().toISOString(),
      reaccess_attempt_count: prev + 1,
    })
    .eq("email", e)
    .eq("reaccess_blocked", true);
  if (upErr) throw new Error(formatErr(upErr));
  return true;
}

export type CancelledUserRow = {
  email: string;
  cancelled_at: string;
  cancelled_by_email: string | null;
  source: string;
  snapshot: CancellationSnapshot | null;
  reaccess_blocked: boolean;
  reaccess_attempt_count: number;
  last_reaccess_attempt_at: string | null;
};

export async function listCancelledUsers(): Promise<CancelledUserRow[]> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database is not configured.");
  const { data, error } = await supabase
    .from("cancelled_users")
    .select("email, cancelled_at, cancelled_by_email, source, snapshot, reaccess_blocked, reaccess_attempt_count, last_reaccess_attempt_at")
    .order("cancelled_at", { ascending: false });
  if (error) throw new Error(formatErr(error));
  const out: CancelledUserRow[] = [];
  for (const r of data ?? []) {
    const row = r as Record<string, unknown>;
    out.push({
      email: String(row.email || ""),
      cancelled_at: String(row.cancelled_at || ""),
      cancelled_by_email: row.cancelled_by_email == null ? null : String(row.cancelled_by_email),
      source: String(row.source || ""),
      snapshot: (row.snapshot as CancellationSnapshot) ?? null,
      reaccess_blocked: !!row.reaccess_blocked,
      reaccess_attempt_count: Number(row.reaccess_attempt_count ?? 0),
      last_reaccess_attempt_at: row.last_reaccess_attempt_at == null ? null : String(row.last_reaccess_attempt_at),
    });
  }
  return out;
}

export async function allowReaccessForEmail(email: string): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database is not configured.");
  const e = norm(email);
  const { data, error } = await supabase
    .from("cancelled_users")
    .update({ reaccess_blocked: false })
    .eq("email", e)
    .select("email")
    .maybeSingle();
  if (error) throw new Error(formatErr(error));
  if (!data) throw new Error("No cancelled-user record for that email.");
}
