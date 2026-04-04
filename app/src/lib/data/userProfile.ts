import { getServiceSupabase } from "@/lib/supabase/service";
import { getPasswordHashForEmail, setPasswordHash } from "@/lib/auth/passwordStore";
import { hashPassword, verifyPassword } from "@/lib/auth/passwordHash";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function formatErr(e: { message: string; details?: string | null; hint?: string | null }): string {
  const parts = [e.message, e.details, e.hint].filter((x): x is string => Boolean(x && String(x).trim()));
  return parts.join(" — ") || "Database error.";
}

export type UserProfileRow = {
  email: string;
  firstName: string | null;
  lastName: string | null;
};

export async function getProfileForEmail(email: string): Promise<UserProfileRow | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;
  const normalized = normalizeEmail(email);
  const { data, error } = await supabase
    .from("memberships")
    .select("user_email, first_name, last_name")
    .eq("user_email", normalized)
    .limit(20);
  if (error) throw new Error(formatErr(error));
  const rows = data ?? [];
  if (rows.length === 0) return null;
  let firstName: string | null = null;
  let lastName: string | null = null;
  for (const r of rows as { first_name?: unknown; last_name?: unknown }[]) {
    if (firstName === null && typeof r.first_name === "string" && r.first_name.trim()) firstName = r.first_name.trim();
    if (lastName === null && typeof r.last_name === "string" && r.last_name.trim()) lastName = r.last_name.trim();
  }
  const first = rows[0] as { first_name?: unknown; last_name?: unknown };
  if (firstName === null && typeof first.first_name === "string") firstName = first.first_name.trim() || null;
  if (lastName === null && typeof first.last_name === "string") lastName = first.last_name.trim() || null;
  return { email: normalized, firstName, lastName };
}

export async function updateDisplayNamesForEmail(
  email: string,
  firstName: string | null,
  lastName: string | null,
): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database is not configured.");
  const normalized = normalizeEmail(email);
  const { error } = await supabase
    .from("memberships")
    .update({ first_name: firstName, last_name: lastName })
    .eq("user_email", normalized);
  if (error) throw new Error(formatErr(error));
}

export async function verifyCurrentPassword(email: string, password: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  const hash = await getPasswordHashForEmail(normalized);
  if (!hash) return false;
  return verifyPassword(password, hash);
}

export async function setPasswordForEmail(email: string, newPassword: string): Promise<void> {
  const normalized = normalizeEmail(email);
  const hash = hashPassword(newPassword);
  await setPasswordHash(normalized, hash);
}

/**
 * Re-point all app data from old email to new (lowercase). Caller must verify password and uniqueness.
 */
export async function changeAccountEmail(oldEmail: string, newEmail: string): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database is not configured.");
  const oldN = normalizeEmail(oldEmail);
  const newN = normalizeEmail(newEmail);
  if (oldN === newN) return;

  const hash = await getPasswordHashForEmail(oldN);
  if (!hash) throw new Error("No password on file for this account.");

  const { data: clash } = await supabase.from("memberships").select("id").eq("user_email", newN).limit(1).maybeSingle();
  if (clash) throw new Error("That email is already in use.");

  const { error: mErr } = await supabase.from("memberships").update({ user_email: newN }).eq("user_email", oldN);
  if (mErr) throw new Error(formatErr(mErr));

  await supabase.from("classes").update({ assigned_teacher_email: newN }).eq("assigned_teacher_email", oldN);

  await supabase.from("reports").update({ author_email: newN }).eq("author_email", oldN);

  await supabase.from("timetable_slots").update({ teacher_email: newN }).eq("teacher_email", oldN);

  await supabase.from("student_events").update({ actor_email: newN }).eq("actor_email", oldN);

  await supabase.from("openai_usage_events").update({ actor_email: newN }).eq("actor_email", oldN);

  await supabase.from("agent_links").update({ agent_email: newN }).eq("agent_email", oldN);
  await supabase.from("referral_earnings").update({ agent_email: newN }).eq("agent_email", oldN);
  await supabase.from("tenants").update({ referred_by_email: newN }).eq("referred_by_email", oldN);
  await supabase.from("test_access_links").update({ claimed_by_email: newN }).eq("claimed_by_email", oldN);
  await supabase.from("test_access_links").update({ created_by_email: newN }).eq("created_by_email", oldN);

  await supabase.from("owner_credit_ledger").update({ owner_email: newN }).eq("owner_email", oldN);

  const { error: delErr } = await supabase.from("auth_passwords").delete().eq("email", oldN);
  if (delErr) throw new Error(formatErr(delErr));

  const { error: insErr } = await supabase.from("auth_passwords").insert({ email: newN, password_hash: hash });
  if (insErr) throw new Error(formatErr(insErr));
}
