import { getServiceSupabase } from "@/lib/supabase/service";
import type { ReportRow } from "@/lib/data/reportsDb";
import { listReportsForTenant } from "@/lib/data/reportsDb";
import { listStudents } from "@/lib/data/students";

function formatErr(e: { message: string; details?: string | null; hint?: string | null }): string {
  const parts = [e.message, e.details, e.hint].filter((x): x is string => Boolean(x && String(x).trim()));
  return parts.join(" — ") || "Database error.";
}

export type ClassScholasticArchiveRow = {
  id: string;
  tenant_id: string;
  class_id: string;
  scholastic_year_label: string;
  archived_at: string;
};

export type ArchivedReportSnapshot = {
  id: string;
  title: string | null;
  body: string;
  body_teacher_preview: string;
  output_language: string;
  teacher_preview_language: string;
  status: string;
  inputs: unknown;
  updated_at: string;
};

export type ArchivedStudentSnapshot = {
  id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  gender: string | null;
  reports: ArchivedReportSnapshot[];
};

export type ClassScholasticArchivePayload = {
  class_name: string;
  scholastic_year: string;
  students: ArchivedStudentSnapshot[];
};

function reportToSnapshot(r: ReportRow): ArchivedReportSnapshot {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    body_teacher_preview: r.body_teacher_preview,
    output_language: r.output_language,
    teacher_preview_language: r.teacher_preview_language,
    status: r.status,
    inputs: r.inputs as unknown,
    updated_at: r.updated_at,
  };
}

/** Snapshot current class data for the ending scholastic year, delete all reports for class students, insert archive row. */
export async function archiveScholasticYearAndResetReports(opts: {
  tenantId: string;
  classId: string;
  className: string;
  endingScholasticYearLabel: string;
}): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");

  const students = await listStudents(opts.tenantId, opts.classId);
  const studentsOut: ArchivedStudentSnapshot[] = [];
  for (const st of students) {
    const reports = await listReportsForTenant(opts.tenantId, st.id);
    studentsOut.push({
      id: st.id,
      display_name: st.display_name,
      first_name: st.first_name,
      last_name: st.last_name,
      gender: st.gender,
      reports: reports.map(reportToSnapshot),
    });
  }

  const payload: ClassScholasticArchivePayload = {
    class_name: opts.className,
    scholastic_year: opts.endingScholasticYearLabel,
    students: studentsOut,
  };

  const { error: insErr } = await supabase.from("class_scholastic_archives").insert({
    tenant_id: opts.tenantId,
    class_id: opts.classId,
    scholastic_year_label: opts.endingScholasticYearLabel,
    payload: payload as unknown as Record<string, unknown>,
  });
  if (insErr) throw new Error(formatErr(insErr));

  const studentIds = students.map((s) => s.id);
  if (studentIds.length === 0) return;

  const { error: delErr } = await supabase.from("reports").delete().eq("tenant_id", opts.tenantId).in("student_id", studentIds);
  if (delErr) throw new Error(formatErr(delErr));
}

export async function listScholasticArchivesForClass(
  tenantId: string,
  classId: string,
): Promise<ClassScholasticArchiveRow[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("class_scholastic_archives")
    .select("id, tenant_id, class_id, scholastic_year_label, archived_at")
    .eq("tenant_id", tenantId)
    .eq("class_id", classId)
    .order("archived_at", { ascending: false });
  if (error) throw new Error(formatErr(error));
  return (data ?? []) as ClassScholasticArchiveRow[];
}

export async function getScholasticArchive(
  tenantId: string,
  classId: string,
  archiveId: string,
): Promise<{ row: ClassScholasticArchiveRow; payload: ClassScholasticArchivePayload } | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("class_scholastic_archives")
    .select("id, tenant_id, class_id, scholastic_year_label, archived_at, payload")
    .eq("tenant_id", tenantId)
    .eq("class_id", classId)
    .eq("id", archiveId)
    .maybeSingle();
  if (error) throw new Error(formatErr(error));
  if (!data) return null;
  const raw = data as Record<string, unknown>;
  const row: ClassScholasticArchiveRow = {
    id: raw.id as string,
    tenant_id: raw.tenant_id as string,
    class_id: raw.class_id as string,
    scholastic_year_label: raw.scholastic_year_label as string,
    archived_at: raw.archived_at as string,
  };
  const payload = raw.payload as ClassScholasticArchivePayload;
  return { row, payload };
}
