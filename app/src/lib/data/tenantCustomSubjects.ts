import { rewriteDefaultSubjectForTenantClasses } from "@/lib/data/classesDb";
import type { GradeRubricProfile } from "@/lib/gradeRubricProfile";
import { isGradeRubricProfile, parseGradeRubricProfile } from "@/lib/gradeRubricProfile";
import { getServiceSupabase } from "@/lib/supabase/service";
import { REPORT_SUBJECTS, isSubjectCode, normalizeDefaultSubjectForStorage } from "@/lib/subjects";

function formatErr(e: { message: string; details?: string | null; hint?: string | null }): string {
  const parts = [e.message, e.details, e.hint].filter((x): x is string => Boolean(x && String(x).trim()));
  return parts.join(" — ") || "Database error.";
}

export type TenantCustomSubjectRow = {
  name: string;
  rubric_profile: GradeRubricProfile;
};

function normalizeRow(raw: unknown): TenantCustomSubjectRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!name || isSubjectCode(name.toLowerCase())) return null;
  const rubric_profile = parseGradeRubricProfile(o.rubric_profile, "secondary");
  return { name, rubric_profile };
}

export async function listTenantCustomSubjects(tenantId: string): Promise<TenantCustomSubjectRow[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from("tenants").select("custom_subjects").eq("id", tenantId).maybeSingle();
  if (error) return [];
  const raw = (data as { custom_subjects?: unknown } | null)?.custom_subjects;
  if (!Array.isArray(raw)) return [];
  const out: TenantCustomSubjectRow[] = [];
  for (const item of raw) {
    const row = normalizeRow(item);
    if (row) out.push(row);
  }
  return out;
}

export function rubricMapFromCustomSubjects(rows: TenantCustomSubjectRow[]): Map<string, GradeRubricProfile> {
  const m = new Map<string, GradeRubricProfile>();
  for (const r of rows) {
    m.set(r.name.trim().toLowerCase(), r.rubric_profile);
  }
  return m;
}

/**
 * Upserts custom subjects (by name, case-insensitive). Updates rubric when the name already exists.
 * Built-in codes are skipped.
 */
export async function mergeTenantCustomSubjectEntries(
  tenantId: string,
  entries: { name: string; rubric_profile?: GradeRubricProfile }[],
): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");

  const cleaned = entries
    .map((e) => ({
      name: e.name.trim(),
      rubric_profile:
        e.rubric_profile !== undefined && isGradeRubricProfile(e.rubric_profile) ? e.rubric_profile : undefined,
    }))
    .filter((e) => e.name.length > 0 && !isSubjectCode(e.name.toLowerCase()));

  if (cleaned.length === 0) return;

  const existing = await listTenantCustomSubjects(tenantId);
  const byLower = new Map<string, TenantCustomSubjectRow>();
  for (const r of existing) {
    byLower.set(r.name.toLowerCase(), r);
  }
  for (const e of cleaned) {
    const prev = byLower.get(e.name.toLowerCase());
    const rubric: GradeRubricProfile =
      e.rubric_profile !== undefined ? e.rubric_profile : prev?.rubric_profile ?? "secondary";
    byLower.set(e.name.toLowerCase(), { name: e.name, rubric_profile: rubric });
  }
  const next = Array.from(byLower.values());

  const { error } = await supabase.from("tenants").update({ custom_subjects: next }).eq("id", tenantId);
  if (error) throw new Error(formatErr(error));
}

export function builtInSubjectCodes(): string[] {
  return REPORT_SUBJECTS.map((s) => s.code);
}

/**
 * Renames a custom school subject and/or updates its rubric profile; updates class defaults that used the old name.
 */
export async function renameTenantCustomSubjectName(
  tenantId: string,
  fromName: string,
  toName: string,
  rubricProfile?: GradeRubricProfile,
): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");

  const from = fromName.trim();
  if (!from || isSubjectCode(from.toLowerCase())) throw new Error("Invalid source subject.");

  const normTo = normalizeDefaultSubjectForStorage(toName);
  if (from.toLowerCase() === normTo.toLowerCase() && rubricProfile === undefined) return;

  const existing = await listTenantCustomSubjects(tenantId);
  const fromIdx = existing.findIndex((s) => s.name.toLowerCase() === from.toLowerCase());
  if (fromIdx === -1) throw new Error("Subject not in school list.");

  const oldRow = existing[fromIdx]!;
  const nextRubric = rubricProfile ?? oldRow.rubric_profile;

  const withoutFrom = existing.filter((s) => s.name.toLowerCase() !== from.toLowerCase());
  let nextList: TenantCustomSubjectRow[];

  if (isSubjectCode(normTo)) {
    nextList = withoutFrom;
  } else {
    const matchIdx = withoutFrom.findIndex((s) => s.name.toLowerCase() === normTo.toLowerCase());
    if (matchIdx === -1) {
      nextList = [...withoutFrom, { name: normTo, rubric_profile: nextRubric }];
    } else {
      nextList = [...withoutFrom];
      nextList[matchIdx] = { name: normTo, rubric_profile: nextRubric };
    }
  }

  const { error } = await supabase.from("tenants").update({ custom_subjects: nextList }).eq("id", tenantId);
  if (error) throw new Error(formatErr(error));

  await rewriteDefaultSubjectForTenantClasses(tenantId, from, normTo);
}

/** Removes a custom subject from the school list and marks matching class defaults for re-definition. */
export async function removeTenantCustomSubjectName(tenantId: string, name: string): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");

  const n = name.trim();
  if (!n || isSubjectCode(n.toLowerCase())) throw new Error("Invalid subject.");

  const existing = await listTenantCustomSubjects(tenantId);
  if (!existing.some((s) => s.name.toLowerCase() === n.toLowerCase())) throw new Error("Subject not in school list.");

  const nextList = existing.filter((s) => s.name.toLowerCase() !== n.toLowerCase());
  const { error } = await supabase.from("tenants").update({ custom_subjects: nextList }).eq("id", tenantId);
  if (error) throw new Error(formatErr(error));

  await rewriteDefaultSubjectForTenantClasses(tenantId, n, "Subject to be Defined");
}
