import { getServiceSupabase } from "@/lib/supabase/service";
import { REPORT_SUBJECTS, isSubjectCode } from "@/lib/subjects";

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
