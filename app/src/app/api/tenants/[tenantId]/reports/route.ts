import { NextResponse } from "next/server";
import { canAccessClass } from "@/lib/auth/classAccess";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { getClassInTenant, listClasses } from "@/lib/data/classesDb";
import { getTenantDefaultReportLanguage } from "@/lib/data/tenantLanguage";
import { getRoleForTenant } from "@/lib/data/memberships";
import { insertReport, listReportsForTenant } from "@/lib/data/reportsDb";
import { getStudentInTenant, listStudents } from "@/lib/data/students";
import { isReportLanguageCode } from "@/lib/i18n/reportLanguages";
import { emptyReportInputs, emptyShortCourseReportInputs, parseReportInputs } from "@/lib/reportInputs";
import { getTenantCreditBalance } from "@/lib/data/credits";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function GET(req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (!role) return NextResponse.json({ error: "No access." }, { status: 403 });

  const url = new URL(req.url);
  const studentId = url.searchParams.get("studentId")?.trim() || "";
  try {
    let reports = await listReportsForTenant(tenantId, studentId && isUuid(studentId) ? studentId : undefined);
    if (role === "teacher") {
      const myClasses = await listClasses(tenantId, { viewerRole: role, viewerEmail: gate.email });
      const ids = new Set(myClasses.map((c) => c.id));
      const visibleStudents = ids.size
        ? await listStudents(tenantId, undefined, { classIds: [...ids] })
        : [];
      const allowed = new Set(visibleStudents.map((s) => s.id));
      reports = reports.filter((r) => allowed.has(r.student_id));
    }
    return NextResponse.json({ reports });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load reports.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (!role) return NextResponse.json({ error: "No access." }, { status: 403 });

  const credits = await getTenantCreditBalance(tenantId);
  if (credits <= 0) {
    return NextResponse.json({ error: "No report credits. Please ask the owner to purchase a pack." }, { status: 402 });
  }

  let body: {
    student_id?: unknown;
    title?: unknown;
    body?: unknown;
    output_language?: unknown;
    inputs?: unknown;
    report_kind?: unknown;
  };
  try {
    body = (await req.json()) as {
      student_id?: unknown;
      title?: unknown;
      body?: unknown;
      output_language?: unknown;
      inputs?: unknown;
      report_kind?: unknown;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const sid = typeof body.student_id === "string" ? body.student_id.trim() : "";
  if (!sid || !isUuid(sid)) return NextResponse.json({ error: "Valid student_id is required." }, { status: 400 });

  const st = await getStudentInTenant(tenantId, sid);
  if (!st) return NextResponse.json({ error: "Student not found in this organisation." }, { status: 404 });

  const klass = await getClassInTenant(tenantId, st.class_id);
  if (!klass) return NextResponse.json({ error: "Class not found." }, { status: 404 });
  if (!canAccessClass({ role, viewerEmail: gate.email, klass })) {
    return NextResponse.json({ error: "You cannot create a report for this student." }, { status: 403 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const reportBody = typeof body.body === "string" ? body.body : "";

  const tenantLang = await getTenantDefaultReportLanguage(tenantId);
  const classLang = isReportLanguageCode(klass.default_output_language) ? klass.default_output_language : tenantLang;
  const langRaw = typeof body.output_language === "string" ? body.output_language.trim() : "";
  const outputLanguage = langRaw && isReportLanguageCode(langRaw) ? langRaw : classLang;
  const wantShort = body.report_kind === "short_course";
  const inputs = wantShort
    ? emptyShortCourseReportInputs()
    : body.inputs !== undefined
      ? parseReportInputs(body.inputs)
      : emptyReportInputs();

  try {
    const report = await insertReport({
      tenantId,
      studentId: sid,
      authorEmail: gate.email,
      title: title || null,
      body: reportBody,
      outputLanguage,
      inputs,
    });
    return NextResponse.json({ report });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create report.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
