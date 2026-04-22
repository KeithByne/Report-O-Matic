import { rewriteDefaultSubjectForTenantClasses } from "@/lib/data/classesDb";
import { getServiceSupabase } from "@/lib/supabase/service";
import { REPORT_SUBJECTS, isSubjectCode, normalizeDefaultSubjectForStorage } from "@/lib/subjects";

function formatErr(e: { message: string; details?: string | null; hint?: string | null }): string {
  const parts = [e.message, e.details, e.hint].filter((x): x is string => Boolean(x && String(x).trim()));
  return parts.join(" — ") || "Database error.";
}

export async function listTenantCustomSubjectNames(tenantId: string): Promise<string[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("tenants")
    .select("custom_subject_names")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) return [];
  const raw = (data as { custom_subject_names?: unknown } | null)?.custom_subject_names;
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x).trim()).filter(Boolean);
}

/**
 * Adds names to the tenant’s custom list (deduped case-insensitively).
 * Built-in subject codes are not stored as custom entries.
 */
export async function mergeTenantCustomSubjectNames(tenantId: string, names: string[]): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");

  const filtered = names
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !isSubjectCode(s.toLowerCase()));

  if (filtered.length === 0) return;

  const existing = await listTenantCustomSubjectNames(tenantId);
  const seen = new Set(existing.map((s) => s.toLowerCase()));
  const merged = [...existing];
  for (const n of filtered) {
    const low = n.toLowerCase();
    if (seen.has(low)) continue;
    seen.add(low);
    merged.push(n);
  }

  const { error } = await supabase.from("tenants").update({ custom_subject_names: merged }).eq("id", tenantId);
  if (error) throw new Error(formatErr(error));
}

export function builtInSubjectCodes(): string[] {
  return REPORT_SUBJECTS.map((s) => s.code);
}

/**
 * Renames a custom school subject: updates the tenant list and any class default that used the old name.
 * Renaming to a built-in code removes the custom list entry and normalizes class defaults to that code.
 */
export async function renameTenantCustomSubjectName(tenantId: string, fromName: string, toName: string): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");

  const from = fromName.trim();
  if (!from || isSubjectCode(from.toLowerCase())) throw new Error("Invalid source subject.");

  const normTo = normalizeDefaultSubjectForStorage(toName);
  if (from.toLowerCase() === normTo.toLowerCase()) return;

  const existing = await listTenantCustomSubjectNames(tenantId);
  const fromIdx = existing.findIndex((s) => s.toLowerCase() === from.toLowerCase());
  if (fromIdx === -1) throw new Error("Subject not in school list.");

  const withoutFrom = existing.filter((s) => s.toLowerCase() !== from.toLowerCase());
  let nextList: string[];
  if (isSubjectCode(normTo)) {
    nextList = withoutFrom;
  } else if (withoutFrom.some((s) => s.toLowerCase() === normTo.toLowerCase())) {
    nextList = withoutFrom;
  } else {
    nextList = [...withoutFrom, normTo];
  }

  const { error } = await supabase.from("tenants").update({ custom_subject_names: nextList }).eq("id", tenantId);
  if (error) throw new Error(formatErr(error));

  await rewriteDefaultSubjectForTenantClasses(tenantId, from, normTo);
}

/** Removes a custom subject from the school list and resets matching class defaults to `efl`. */
export async function removeTenantCustomSubjectName(tenantId: string, name: string): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");

  const n = name.trim();
  if (!n || isSubjectCode(n.toLowerCase())) throw new Error("Invalid subject.");

  const existing = await listTenantCustomSubjectNames(tenantId);
  if (!existing.some((s) => s.toLowerCase() === n.toLowerCase())) throw new Error("Subject not in school list.");

  const nextList = existing.filter((s) => s.toLowerCase() !== n.toLowerCase());
  const { error } = await supabase.from("tenants").update({ custom_subject_names: nextList }).eq("id", tenantId);
  if (error) throw new Error(formatErr(error));

  await rewriteDefaultSubjectForTenantClasses(tenantId, n, "efl");
}
