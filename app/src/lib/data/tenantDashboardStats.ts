import { getServiceSupabase } from "@/lib/supabase/service";
import { listStudents } from "@/lib/data/students";
import { listClasses } from "@/lib/data/classesDb";
import { listReportsForTenant } from "@/lib/data/reportsDb";
import { listMembersForTenant, type TenantMemberRow } from "@/lib/data/memberships";
import { listStudentEventCountsByActor } from "@/lib/data/studentEvents";

function formatErr(e: { message: string; details?: string | null; hint?: string | null }): string {
  const parts = [e.message, e.details, e.hint].filter((x): x is string => Boolean(x && String(x).trim()));
  return parts.join(" — ") || "Database error.";
}

export type TenantSummaryStats = {
  teachers: number;
  classes: number;
  students: number;
  reportsRendered: number;
};

export async function getTenantSummaryStats(tenantId: string): Promise<TenantSummaryStats> {
  // Uses service role. If DB isn't configured, return zeros.
  const supabase = getServiceSupabase();
  if (!supabase) return { teachers: 0, classes: 0, students: 0, reportsRendered: 0 };

  const [members, classes, students, reports] = await Promise.all([
    supabase.from("memberships").select("role", { count: "exact", head: false }).eq("tenant_id", tenantId),
    supabase.from("classes").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase.from("students").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .neq("body", ""),
  ]);

  if (members.error) throw new Error(formatErr(members.error));
  if (classes.error) throw new Error(formatErr(classes.error));
  if (students.error) throw new Error(formatErr(students.error));
  if (reports.error) throw new Error(formatErr(reports.error));

  const teacherCount = (members.data ?? []).filter((r: { role: string }) => r.role === "teacher").length;
  return {
    teachers: teacherCount,
    classes: classes.count ?? 0,
    students: students.count ?? 0,
    reportsRendered: reports.count ?? 0,
  };
}

export type TeacherStats = {
  email: string;
  classes: number;
  students: number;
  reportsByTerm: { first: number; second: number; third: number };
  studentEvents: { added: number; deleted: number; moved: number };
};

export async function getTeacherStatsForTenant(opts: {
  tenantId: string;
  roster: TenantMemberRow[];
}): Promise<TeacherStats[]> {
  const teacherEmails = opts.roster
    .filter((m) => m.role === "teacher")
    .map((m) => m.user_email.trim().toLowerCase())
    .filter(Boolean);

  if (teacherEmails.length === 0) return [];

  // Classes assigned to each teacher.
  const classes = await listClasses(opts.tenantId);
  const classesByTeacher = new Map<string, string[]>();
  for (const c of classes) {
    const em = (c.assigned_teacher_email || "").trim().toLowerCase();
    if (!em) continue;
    if (!classesByTeacher.has(em)) classesByTeacher.set(em, []);
    classesByTeacher.get(em)!.push(c.id);
  }

  // Students per teacher: all students in their assigned classes.
  const studentsAll = await listStudents(opts.tenantId);
  const studentsByClass = new Map<string, number>();
  for (const s of studentsAll) studentsByClass.set(s.class_id, (studentsByClass.get(s.class_id) ?? 0) + 1);

  // Reports by term: pull once and aggregate in code.
  const reportsAll = await listReportsForTenant(opts.tenantId);
  const reportsByTeacher: Record<string, { first: number; second: number; third: number }> = {};
  for (const em of teacherEmails) reportsByTeacher[em] = { first: 0, second: 0, third: 0 };
  for (const r of reportsAll) {
    const em = r.author_email.trim().toLowerCase();
    if (!reportsByTeacher[em]) continue;
    // "rendered" = has non-empty body
    if (!String(r.body || "").trim()) continue;
    const term = r.inputs?.report_period;
    if (term === "first" || term === "second" || term === "third") reportsByTeacher[em][term] += 1;
  }

  // Student events by actor (all-time for now).
  const eventCounts = await listStudentEventCountsByActor({ tenantId: opts.tenantId, actorEmails: teacherEmails });

  return teacherEmails.map((email) => {
    const classIds = classesByTeacher.get(email) ?? [];
    const studentCount = classIds.reduce((sum, cid) => sum + (studentsByClass.get(cid) ?? 0), 0);
    return {
      email,
      classes: classIds.length,
      students: studentCount,
      reportsByTerm: reportsByTeacher[email] ?? { first: 0, second: 0, third: 0 },
      studentEvents: eventCounts[email] ?? { added: 0, deleted: 0, moved: 0 },
    };
  });
}

