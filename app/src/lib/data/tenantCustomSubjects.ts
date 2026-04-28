import { getServiceSupabase } from "@/lib/supabase/service";
import { isSubjectCode } from "@/lib/subjects";

function formatErr(e: { message: string; details?: string | null; hint?: string | null }): string {
  const parts = [e.message, e.details, e.hint].filter((x): x is string => Boolean(x && String(x).trim()));
  return parts.join(" — ") || "Database error.";
}

function dedupeCaseInsensitive(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    const t = n.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

export async function listTenantCustomSubjectNames(tenantId: string): Promise<string[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("tenants")
    .select("custom_subject_names")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) throw new Error(formatErr(error));
  const raw = (data as { custom_subject_names?: unknown } | null)?.custom_subject_names;
  if (!Array.isArray(raw)) return [];
  return dedupeCaseInsensitive(
    raw.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean),
  );
}

/** Merges names into the tenant list (skips built-in subject codes). */
export async function mergeTenantCustomSubjectNames(tenantId: string, names: string[]): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const toAdd = names
    .map((n) => n.trim())
    .filter((n) => n.length > 0 && !isSubjectCode(n.toLowerCase()));
  if (toAdd.length === 0) return;

  const current = await listTenantCustomSubjectNames(tenantId);
  const merged = dedupeCaseInsensitive([...current, ...toAdd]);
  const { error } = await supabase.from("tenants").update({ custom_subject_names: merged }).eq("id", tenantId);
  if (error) throw new Error(formatErr(error));
}
