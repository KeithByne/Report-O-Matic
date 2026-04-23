import { getMembershipDisplayNameForEmail } from "@/lib/data/memberships";
import { getServiceSupabase } from "@/lib/supabase/service";
import type { WeekdayKey } from "@/lib/activeWeekdays";
import { normalizeActiveWeekdays, parseActiveWeekdaysFromDb } from "@/lib/activeWeekdays";
import type { ReportLanguageCode } from "@/lib/i18n/reportLanguages";
import type { RomRole } from "@/lib/data/memberships";
import { coerceStoredDefaultSubject } from "@/lib/subjects";
import type { ReportKind, ReportPeriod } from "@/lib/reportInputs";
import { syncTimetableSlotsTeacherForClass } from "@/lib/data/timetableDb";
import type { GradeRubricProfile } from "@/lib/gradeRubricProfile";
import { parseGradeRubricProfile } from "@/lib/gradeRubricProfile";

export type { CefrLevel } from "@/lib/classLevel";

function formatErr(e: { message: string; details?: string | null; hint?: string | null }): string {
  const parts = [e.message, e.details, e.hint].filter((x): x is string => Boolean(x && String(x).trim()));
  return parts.join(" — ") || "Database error.";
}

function isMissingGradeRubricProfileColumnError(e: { message?: string | null; details?: string | null; hint?: string | null }): boolean {
  const msg = [e.message, e.details, e.hint].filter(Boolean).join(" ").toLowerCase();
  return msg.includes("grade_rubric_profile") && msg.includes("schema cache");
}

function formatClassWriteErr(e: { message: string; details?: string | null; hint?: string | null }): string {
  if (isMissingGradeRubricProfileColumnError(e)) {
    return "Database schema is behind: `classes.grade_rubric_profile` is missing from Supabase schema cache. Run the latest migrations, then reload PostgREST schema (or restart Supabase) and retry.";
  }
  return formatErr(e);
}

export type ClassRow = {
  id: string;
  tenant_id: string;
  name: string;
  scholastic_year: string | null;
  /** CEFR bands (language classes) or `Year n` labels (primary/secondary); column name is legacy. */
  cefr_level: string | null;
  default_subject: string;
  default_output_language: ReportLanguageCode;
  default_new_report_kind: ReportKind;
  /** Default `report_period` for new standard reports created for pupils in this class. */
  default_new_report_period: ReportPeriod;
  /** Educational context: drives class level options (CEFR vs year) and default report rubric. */
  grade_rubric_profile: GradeRubricProfile;
  assigned_teacher_email: string | null;
  active_weekdays: WeekdayKey[];
  created_at: string;
};

/** Class row plus membership display names for the assigned teacher (API responses). */
export type ClassRowWithTeacherDisplay = ClassRow & {
  assigned_teacher_first_name: string | null;
  assigned_teacher_last_name: string | null;
};

export async function enrichClassWithAssignedTeacherDisplay(tenantId: string, klass: ClassRow): Promise<ClassRowWithTeacherDisplay> {
  if (!klass.assigned_teacher_email?.trim()) {
    return { ...klass, assigned_teacher_first_name: null, assigned_teacher_last_name: null };
  }
  const n = await getMembershipDisplayNameForEmail(tenantId, klass.assigned_teacher_email);
  return {
    ...klass,
    assigned_teacher_first_name: n?.first_name ?? null,
    assigned_teacher_last_name: n?.last_name ?? null,
  };
}

/**
 * Use `*` so reads succeed before optional migrations (e.g. `default_new_report_period`) exist on the DB.
 * `mapClassRow` defaults any missing fields.
 */
const classSelect = "*";

function parseReportKind(raw: unknown): ReportKind {
  return raw === "short_course" ? "short_course" : "standard";
}

export function parseDefaultNewReportPeriod(raw: unknown): ReportPeriod {
  if (raw === "second" || raw === "third") return raw;
  return "first";
}

function mapClassRow(raw: Record<string, unknown>): ClassRow {
  return {
    id: raw.id as string,
    tenant_id: raw.tenant_id as string,
    name: raw.name as string,
    scholastic_year: (raw.scholastic_year as string | null) ?? null,
    cefr_level: raw.cefr_level == null ? null : String(raw.cefr_level),
    default_subject: coerceStoredDefaultSubject(raw.default_subject),
    default_output_language: raw.default_output_language as ReportLanguageCode,
    default_new_report_kind: parseReportKind(raw.default_new_report_kind),
    default_new_report_period: parseDefaultNewReportPeriod(raw.default_new_report_period),
    grade_rubric_profile: parseGradeRubricProfile(raw.grade_rubric_profile, "language"),
    assigned_teacher_email: (raw.assigned_teacher_email as string | null) ?? null,
    active_weekdays: parseActiveWeekdaysFromDb(raw.active_weekdays),
    created_at: raw.created_at as string,
  };
}

export async function listClasses(
  tenantId: string,
  opts?: { viewerRole?: RomRole; viewerEmail?: string },
): Promise<ClassRow[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return [];
  let q = supabase.from("classes").select(classSelect).eq("tenant_id", tenantId);
  if (opts?.viewerRole === "teacher" && opts.viewerEmail?.trim()) {
    const e = opts.viewerEmail.trim().toLowerCase();
    q = q.eq("assigned_teacher_email", e);
  }
  const { data, error } = await q.order("name", { ascending: true });
  if (error) throw new Error(formatErr(error));
  return (data ?? []).map((row) => mapClassRow(row as Record<string, unknown>));
}

export async function insertClass(opts: {
  tenantId: string;
  name: string;
  scholasticYear?: string | null;
  cefrLevel?: string | null;
  defaultSubject?: string;
  gradeRubricProfile?: GradeRubricProfile;
  defaultOutputLanguage?: ReportLanguageCode;
  assignedTeacherEmail?: string | null;
}): Promise<ClassRow> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const name = opts.name.trim();
  if (!name) throw new Error("Class name is required.");
  const row: Record<string, unknown> = {
    tenant_id: opts.tenantId,
    name,
    scholastic_year: opts.scholasticYear?.trim() || null,
    cefr_level: opts.cefrLevel ?? null,
    default_subject: opts.defaultSubject?.trim()
      ? coerceStoredDefaultSubject(opts.defaultSubject)
      : "efl",
    default_output_language: opts.defaultOutputLanguage ?? "en",
    default_new_report_kind: "standard",
    assigned_teacher_email: opts.assignedTeacherEmail?.trim().toLowerCase() ?? null,
    active_weekdays: [],
    /** Must be set from the create-class flow; column defaults to `language` if omitted (wrong for primary/secondary). */
    grade_rubric_profile: opts.gradeRubricProfile ?? "language",
  };
  const { data, error } = await supabase.from("classes").insert(row).select(classSelect).single();
  if (error) throw new Error(formatClassWriteErr(error));
  return mapClassRow(data as Record<string, unknown>);
}

export async function getClassInTenant(tenantId: string, classId: string): Promise<ClassRow | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("classes")
    .select(classSelect)
    .eq("tenant_id", tenantId)
    .eq("id", classId)
    .maybeSingle();
  if (error) throw new Error(formatErr(error));
  return data ? mapClassRow(data as Record<string, unknown>) : null;
}

export async function updateClass(
  tenantId: string,
  classId: string,
  patch: {
    name?: string;
    scholastic_year?: string | null;
    cefr_level?: string | null;
    default_subject?: string;
    default_output_language?: ReportLanguageCode;
    default_new_report_kind?: ReportKind;
    default_new_report_period?: ReportPeriod;
    grade_rubric_profile?: GradeRubricProfile;
    assigned_teacher_email?: string | null;
    active_weekdays?: WeekdayKey[];
  },
): Promise<ClassRow> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");

  let priorAssigned: string | null | undefined;
  if (patch.assigned_teacher_email !== undefined) {
    const priorRow = await getClassInTenant(tenantId, classId);
    if (!priorRow) throw new Error("Class not found.");
    priorAssigned = priorRow.assigned_teacher_email;
  }

  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.scholastic_year !== undefined) row.scholastic_year = patch.scholastic_year?.trim() || null;
  if (patch.cefr_level !== undefined) row.cefr_level = patch.cefr_level;
  if (patch.default_subject !== undefined) row.default_subject = patch.default_subject;
  if (patch.default_output_language !== undefined) row.default_output_language = patch.default_output_language;
  if (patch.default_new_report_kind !== undefined) {
    row.default_new_report_kind = patch.default_new_report_kind === "short_course" ? "short_course" : "standard";
  }
  if (patch.default_new_report_period !== undefined) {
    row.default_new_report_period = patch.default_new_report_period;
  }
  if (patch.grade_rubric_profile !== undefined) {
    row.grade_rubric_profile = patch.grade_rubric_profile;
  }
  if (patch.assigned_teacher_email !== undefined) {
    row.assigned_teacher_email = patch.assigned_teacher_email?.trim().toLowerCase() || null;
  }
  if (patch.active_weekdays !== undefined) {
    row.active_weekdays = normalizeActiveWeekdays(patch.active_weekdays);
  }
  const { data, error } = await supabase
    .from("classes")
    .update(row)
    .eq("tenant_id", tenantId)
    .eq("id", classId)
    .select(classSelect)
    .single();
  if (error) throw new Error(formatClassWriteErr(error));
  const updated = mapClassRow(data as Record<string, unknown>);

  if (patch.assigned_teacher_email !== undefined) {
    try {
      await syncTimetableSlotsTeacherForClass(tenantId, classId, updated.assigned_teacher_email);
    } catch (syncErr) {
      const { error: revErr } = await supabase
        .from("classes")
        .update({ assigned_teacher_email: priorAssigned ?? null })
        .eq("tenant_id", tenantId)
        .eq("id", classId);
      if (revErr) throw new Error(formatErr(revErr));
      throw syncErr instanceof Error ? syncErr : new Error("Could not update timetable slots for this teacher change.");
    }
  }

  return updated;
}

export async function deleteClassInTenant(tenantId: string, classId: string): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const { error } = await supabase.from("classes").delete().eq("tenant_id", tenantId).eq("id", classId);
  if (error) throw new Error(formatErr(error));
}

/**
 * Updates every class in the tenant whose `default_subject` matches `fromName` (case-insensitive trim).
 * Used when renaming or removing a custom subject from the school list.
 */
export async function rewriteDefaultSubjectForTenantClasses(
  tenantId: string,
  fromName: string,
  toStored: string,
): Promise<number> {
  const fromLow = fromName.trim().toLowerCase();
  if (!fromLow) return 0;
  const classes = await listClasses(tenantId);
  let count = 0;
  for (const c of classes) {
    if (c.default_subject.trim().toLowerCase() !== fromLow) continue;
    await updateClass(tenantId, c.id, { default_subject: toStored });
    count++;
  }
  return count;
}
