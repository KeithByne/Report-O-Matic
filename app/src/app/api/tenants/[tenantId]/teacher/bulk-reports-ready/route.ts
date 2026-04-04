import { NextResponse } from "next/server";
import { canAccessClass } from "@/lib/auth/classAccess";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { getClassInTenant, listClasses } from "@/lib/data/classesDb";
import { getRoleForTenant } from "@/lib/data/memberships";
import { listReportsForTenant } from "@/lib/data/reportsDb";
import { listStudents } from "@/lib/data/students";
import {
  parseClassBulkPdfTermFilter,
  reportReadyForClassBulkPdf,
  type ReportPeriod,
} from "@/lib/reportInputs";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/**
 * GET ?classId= — readiness for class PDF batch (short-course path, term=all). Matches classes/.../pdf-batch.
 * GET ?term=first|second|third — readiness for tenant reports PDF batch (teacher term bulk). Matches reports/pdf-batch for teachers.
 */
export async function GET(req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });

  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (role !== "teacher") {
    return NextResponse.json({ error: "Only teachers can check this." }, { status: 403 });
  }

  const url = new URL(req.url);
  const classId = (url.searchParams.get("classId") || "").trim();

  if (classId) {
    if (!isUuid(classId)) return NextResponse.json({ ready: false }, { status: 400 });
    const klass = await getClassInTenant(tenantId, classId);
    if (!klass || !canAccessClass({ role, viewerEmail: gate.email, klass })) {
      return NextResponse.json({ ready: false });
    }

    const students = await listStudents(tenantId, classId);
    if (students.length === 0) return NextResponse.json({ ready: false });

    const reportsAll = await listReportsForTenant(tenantId);
    const allowedStudents = new Set(students.map((s) => s.id));
    const reports = reportsAll.filter((r) => allowedStudents.has(r.student_id));

    const rowReady = (r: (typeof reports)[number]) =>
      reportReadyForClassBulkPdf({ status: r.status, body: r.body, inputs: r.inputs });

    const byStudent = new Map<string, typeof reports>();
    for (const r of reports) {
      const arr = byStudent.get(r.student_id) ?? [];
      arr.push(r);
      byStudent.set(r.student_id, arr);
    }
    for (const s of students) {
      const rs = byStudent.get(s.id);
      if (!rs?.length) return NextResponse.json({ ready: false });
    }

    if (reports.some((r) => !rowReady(r))) return NextResponse.json({ ready: false });
    return NextResponse.json({ ready: true });
  }

  const termFilter = parseClassBulkPdfTermFilter(url.searchParams.get("term"));
  if (termFilter === "all") {
    return NextResponse.json({ error: "term or classId is required." }, { status: 400 });
  }
  const period = termFilter as ReportPeriod;

  const classes = await listClasses(tenantId, { viewerRole: "teacher", viewerEmail: gate.email });
  const classIds = classes.map((c) => c.id);
  const students = classIds.length ? await listStudents(tenantId, undefined, { classIds }) : [];
  if (students.length === 0) return NextResponse.json({ ready: false });

  const me = gate.email.trim().toLowerCase();
  let reports = await listReportsForTenant(tenantId);
  const allowedStudents = new Set(students.map((s) => s.id));
  reports = reports.filter((r) => allowedStudents.has(r.student_id));

  const rowReady = (r: (typeof reports)[number]) =>
    reportReadyForClassBulkPdf({ status: r.status, body: r.body, inputs: r.inputs });

  const forTerm = reports
    .filter((r) => r.author_email.trim().toLowerCase() === me)
    .filter((r) => r.status === "final" && rowReady(r))
    .filter((r) => r.inputs.report_period === period);

  const covered = new Set(forTerm.map((r) => r.student_id));
  for (const s of students) {
    if (!covered.has(s.id)) return NextResponse.json({ ready: false });
  }

  return NextResponse.json({ ready: true });
}
