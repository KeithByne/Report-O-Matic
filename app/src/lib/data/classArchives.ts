import { getServiceSupabase } from "@/lib/supabase/service";
import type { ReportRow } from "@/lib/data/reportsDb";
import { listReportsForTenant } from "@/lib/data/reportsDb";
import { getClassInTenant } from "@/lib/data/classesDb";
import { normalizeScholasticYearLabel } from "@/lib/scholasticYear";

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

async function listOpenStudentsInClass(
  tenantId: string,
  classId: string,
): Promise<
  {
    id: string;
    school_student_id: string;
    display_name: string;
    first_name: string | null;
    last_name: string | null;
    gender: string | null;
  }[]
> {
  const supabase = getServiceSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("students")
    .select("id, school_student_id, display_name, first_name, last_name, gender")
    .eq("tenant_id", tenantId)
    .eq("class_id", classId)
    .is("enrollment_ended_at", null)
    .order("display_name", { ascending: true });
  if (error) throw new Error(formatErr(error));
  return (data ?? []) as {
    id: string;
    school_student_id: string;
    display_name: string;
    first_name: string | null;
    last_name: string | null;
    gender: string | null;
  }[];
}

async function insertStudentArchiveAndDeleteReports(opts: {
  tenantId: string;
  archiveClassId: string;
  className: string;
  yearLabel: string;
  student: ArchivedStudentSnapshot;
  /** When set, only these report ids are deleted (must match student.reports). */
  deleteReportIds?: string[];
}): Promise<void> {
  if (opts.student.reports.length === 0) return;
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");

  const payload: ClassScholasticArchivePayload = {
    class_name: opts.className,
    scholastic_year: opts.yearLabel,
    students: [opts.student],
  };

  const { error: insErr } = await supabase.from("class_scholastic_archives").insert({
    tenant_id: opts.tenantId,
    class_id: opts.archiveClassId,
    scholastic_year_label: opts.yearLabel,
    payload: payload as unknown as Record<string, unknown>,
  });
  if (insErr) throw new Error(formatErr(insErr));

  const ids = opts.deleteReportIds?.length
    ? opts.deleteReportIds
    : opts.student.reports.map((r) => r.id);
  if (ids.length === 0) return;

  const { error: delErr } = await supabase
    .from("reports")
    .delete()
    .eq("tenant_id", opts.tenantId)
    .eq("student_id", opts.student.id)
    .in("id", ids);
  if (delErr) throw new Error(formatErr(delErr));
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

  const students = await listOpenStudentsInClass(opts.tenantId, opts.classId);
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

/**
 * When a pupil moves/imports into a class with a different scholastic year, snapshot their
 * current reports onto the source class archive and delete live reports so they arrive clean.
 * Same scholastic year → no-op (reports stay on the enrollment and follow the move).
 */
export async function archiveAndClearStudentReportsIfScholasticYearDiffers(opts: {
  tenantId: string;
  studentId: string;
  fromClassId: string;
  toClassId: string;
  displayName?: string;
  firstName?: string | null;
  lastName?: string | null;
  gender?: string | null;
}): Promise<"followed" | "archived" | "noop"> {
  if (opts.fromClassId === opts.toClassId) return "noop";

  const fromKlass = await getClassInTenant(opts.tenantId, opts.fromClassId);
  const toKlass = await getClassInTenant(opts.tenantId, opts.toClassId);
  if (!fromKlass || !toKlass) return "noop";

  const fromYear = normalizeScholasticYearLabel(fromKlass.scholastic_year);
  const toYear = normalizeScholasticYearLabel(toKlass.scholastic_year);
  if (fromYear === toYear) return "followed";

  const reports = await listReportsForTenant(opts.tenantId, opts.studentId);
  if (reports.length === 0) return "archived";

  await insertStudentArchiveAndDeleteReports({
    tenantId: opts.tenantId,
    archiveClassId: opts.fromClassId,
    className: fromKlass.name,
    yearLabel: fromKlass.scholastic_year?.trim() || "Year not specified",
    student: {
      id: opts.studentId,
      display_name: opts.displayName?.trim() || "Pupil",
      first_name: opts.firstName ?? null,
      last_name: opts.lastName ?? null,
      gender: opts.gender ?? null,
      reports: reports.map(reportToSnapshot),
    },
  });

  return "archived";
}

/**
 * For roster / inactive imports: clear reports on prior enrollments when the destination
 * class scholastic year differs from each prior enrollment’s class year.
 */
export async function archiveAndClearPriorEnrollmentsIfScholasticYearDiffers(opts: {
  tenantId: string;
  schoolStudentId: string;
  toClassId: string;
}): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");

  const toKlass = await getClassInTenant(opts.tenantId, opts.toClassId);
  if (!toKlass) return;
  const toYear = normalizeScholasticYearLabel(toKlass.scholastic_year);

  const { data, error } = await supabase
    .from("students")
    .select("id, class_id, display_name, first_name, last_name, gender")
    .eq("tenant_id", opts.tenantId)
    .eq("school_student_id", opts.schoolStudentId);
  if (error) throw new Error(formatErr(error));

  for (const row of (data ?? []) as {
    id: string;
    class_id: string;
    display_name: string;
    first_name: string | null;
    last_name: string | null;
    gender: string | null;
  }[]) {
    if (row.class_id === opts.toClassId) continue;
    const fromKlass = await getClassInTenant(opts.tenantId, row.class_id);
    if (!fromKlass) continue;
    if (normalizeScholasticYearLabel(fromKlass.scholastic_year) === toYear) continue;
    await archiveAndClearStudentReportsIfScholasticYearDiffers({
      tenantId: opts.tenantId,
      studentId: row.id,
      fromClassId: row.class_id,
      toClassId: opts.toClassId,
      displayName: row.display_name,
      firstName: row.first_name,
      lastName: row.last_name,
      gender: row.gender,
    });
  }
}

/**
 * Heal pupils already in a class who still have live reports that belong to a previous
 * scholastic year (cross-year import leftovers, or reports older than this class’s last year archive).
 */
export async function healStalePreviousYearReportsForClass(opts: {
  tenantId: string;
  classId: string;
}): Promise<number> {
  const klass = await getClassInTenant(opts.tenantId, opts.classId);
  if (!klass) return 0;
  const currentYear = normalizeScholasticYearLabel(klass.scholastic_year);

  const supabase = getServiceSupabase();
  if (!supabase) return 0;

  const { data: archiveRows, error: archErr } = await supabase
    .from("class_scholastic_archives")
    .select("scholastic_year_label, archived_at")
    .eq("tenant_id", opts.tenantId)
    .eq("class_id", opts.classId)
    .order("archived_at", { ascending: false });
  if (archErr) throw new Error(formatErr(archErr));

  const latestArchiveAt =
    Array.isArray(archiveRows) && archiveRows.length > 0
      ? String((archiveRows[0] as { archived_at: string }).archived_at)
      : null;
  const previousArchiveYearLabel =
    (archiveRows?.[0] as { scholastic_year_label?: string } | undefined)?.scholastic_year_label?.trim() ||
    "Year not specified";

  const students = await listOpenStudentsInClass(opts.tenantId, opts.classId);
  let cleared = 0;

  for (const st of students) {
    const reports = await listReportsForTenant(opts.tenantId, st.id);
    if (reports.length === 0) continue;

    const { data: priorEnrollments, error: priorErr } = await supabase
      .from("students")
      .select("class_id, enrollment_ended_at")
      .eq("tenant_id", opts.tenantId)
      .eq("school_student_id", st.school_student_id);
    if (priorErr) throw new Error(formatErr(priorErr));

    let otherYearClassId: string | null = null;
    let otherYearLabel = previousArchiveYearLabel;
    /** Only archive reports older than this instant (avoids wiping reports written after a cross-year move). */
    let crossYearCutoffIso: string | null = null;

    for (const pe of (priorEnrollments ?? []) as { class_id: string; enrollment_ended_at: string | null }[]) {
      // Only ended enrollments count as a “previous” class year for leftover reports.
      if (!pe.enrollment_ended_at) continue;
      if (pe.class_id === opts.classId) continue;
      const priorKlass = await getClassInTenant(opts.tenantId, pe.class_id);
      if (!priorKlass) continue;
      if (normalizeScholasticYearLabel(priorKlass.scholastic_year) !== currentYear) {
        otherYearClassId = pe.class_id;
        otherYearLabel = priorKlass.scholastic_year?.trim() || previousArchiveYearLabel;
        crossYearCutoffIso = pe.enrollment_ended_at;
        break;
      }
    }

    // Moves keep the same enrollment row (class_id updated in place), so also check move events.
    if (!otherYearClassId) {
      const { data: moveEv, error: moveErr } = await supabase
        .from("student_events")
        .select("from_class_id, created_at")
        .eq("tenant_id", opts.tenantId)
        .eq("student_id", st.id)
        .eq("event_type", "moved")
        .not("from_class_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(5);
      if (moveErr) throw new Error(formatErr(moveErr));
      for (const ev of (moveEv ?? []) as { from_class_id: string; created_at: string }[]) {
        if (!ev.from_class_id || ev.from_class_id === opts.classId) continue;
        const priorKlass = await getClassInTenant(opts.tenantId, ev.from_class_id);
        if (!priorKlass) continue;
        if (normalizeScholasticYearLabel(priorKlass.scholastic_year) !== currentYear) {
          otherYearClassId = ev.from_class_id;
          otherYearLabel = priorKlass.scholastic_year?.trim() || previousArchiveYearLabel;
          crossYearCutoffIso = ev.created_at;
          break;
        }
      }
    }

    // Reports created before this class’s last scholastic-year archive are previous-year leftovers.
    const staleFromArchiveClock =
      latestArchiveAt != null
        ? reports.filter((r) => new Date(r.created_at).getTime() < new Date(latestArchiveAt).getTime())
        : [];

    // Cross-year leftovers: reports that predate the move / ended enrollment (not new-year work).
    const staleFromCrossYear =
      otherYearClassId != null && crossYearCutoffIso
        ? reports.filter((r) => new Date(r.created_at).getTime() < new Date(crossYearCutoffIso).getTime())
        : [];

    const toArchive =
      staleFromCrossYear.length > 0
        ? staleFromCrossYear
        : otherYearClassId != null && !crossYearCutoffIso
          ? reports
          : staleFromArchiveClock;

    if (toArchive.length === 0) continue;

    await insertStudentArchiveAndDeleteReports({
      tenantId: opts.tenantId,
      archiveClassId: otherYearClassId ?? opts.classId,
      className: otherYearClassId
        ? (await getClassInTenant(opts.tenantId, otherYearClassId))?.name || klass.name
        : klass.name,
      yearLabel: otherYearClassId != null ? otherYearLabel : previousArchiveYearLabel,
      student: {
        id: st.id,
        display_name: st.display_name,
        first_name: st.first_name,
        last_name: st.last_name,
        gender: st.gender,
        reports: toArchive.map(reportToSnapshot),
      },
      deleteReportIds: toArchive.map((r) => r.id),
    });
    cleared += 1;
  }

  return cleared;
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
