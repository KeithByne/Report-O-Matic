import {
  parseClassMetricLabelOverrides,
  pickSkillMetricOverrides,
  subjectMetricLabelsStorageKey,
  type ClassMetricLabelOverrides,
} from "@/lib/classMetricLabels";
import { getServiceSupabase } from "@/lib/supabase/service";

function formatErr(e: { message: string; details?: string | null; hint?: string | null }): string {
  const parts = [e.message, e.details, e.hint].filter((x): x is string => Boolean(x && String(x).trim()));
  return parts.join(" — ") || "Database error.";
}

export type TenantSubjectMetricLabelsMap = Record<string, ClassMetricLabelOverrides>;

function parseMap(raw: unknown): TenantSubjectMetricLabelsMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: TenantSubjectMetricLabelsMap = {};
  for (const [subjectKey, labels] of Object.entries(raw as Record<string, unknown>)) {
    const key = subjectMetricLabelsStorageKey(subjectKey);
    const parsed = pickSkillMetricOverrides(parseClassMetricLabelOverrides(labels));
    if (Object.keys(parsed).length > 0) out[key] = parsed;
  }
  return out;
}

export async function getTenantSubjectMetricLabelsMap(tenantId: string): Promise<TenantSubjectMetricLabelsMap> {
  const supabase = getServiceSupabase();
  if (!supabase) return {};
  const { data, error } = await supabase
    .from("tenants")
    .select("subject_metric_labels")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) return {};
  return parseMap((data as { subject_metric_labels?: unknown } | null)?.subject_metric_labels);
}

export async function getSubjectSkillMetricLabels(
  tenantId: string,
  storedSubject: string,
): Promise<ClassMetricLabelOverrides> {
  const key = subjectMetricLabelsStorageKey(storedSubject);
  const map = await getTenantSubjectMetricLabelsMap(tenantId);
  return map[key] ?? {};
}

export async function setSubjectSkillMetricLabels(
  tenantId: string,
  storedSubject: string,
  overrides: ClassMetricLabelOverrides,
): Promise<TenantSubjectMetricLabelsMap> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const key = subjectMetricLabelsStorageKey(storedSubject);
  const cleaned = pickSkillMetricOverrides(parseClassMetricLabelOverrides(overrides));
  const map = await getTenantSubjectMetricLabelsMap(tenantId);
  const next = { ...map };
  if (Object.keys(cleaned).length === 0) delete next[key];
  else next[key] = cleaned;
  const { error } = await supabase.from("tenants").update({ subject_metric_labels: next }).eq("id", tenantId);
  if (error) throw new Error(formatErr(error));
  return next;
}

export async function renameSubjectMetricLabelsKey(
  tenantId: string,
  fromStoredSubject: string,
  toStoredSubject: string,
): Promise<void> {
  const fromKey = subjectMetricLabelsStorageKey(fromStoredSubject);
  const toKey = subjectMetricLabelsStorageKey(toStoredSubject);
  if (fromKey === toKey) return;
  const map = await getTenantSubjectMetricLabelsMap(tenantId);
  const labels = map[fromKey];
  if (!labels) return;
  const next = { ...map };
  delete next[fromKey];
  next[toKey] = labels;
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const { error } = await supabase.from("tenants").update({ subject_metric_labels: next }).eq("id", tenantId);
  if (error) throw new Error(formatErr(error));
}

export async function removeSubjectMetricLabelsKey(tenantId: string, storedSubject: string): Promise<void> {
  const key = subjectMetricLabelsStorageKey(storedSubject);
  const map = await getTenantSubjectMetricLabelsMap(tenantId);
  if (!map[key]) return;
  const next = { ...map };
  delete next[key];
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const { error } = await supabase.from("tenants").update({ subject_metric_labels: next }).eq("id", tenantId);
  if (error) throw new Error(formatErr(error));
}
