import { NextResponse } from "next/server";
import { canAccessClass } from "@/lib/auth/classAccess";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import type { ReportLanguageCode } from "@/lib/i18n/reportLanguages";
import { isReportLanguageCode } from "@/lib/i18n/reportLanguages";
import type { ReportInputs } from "@/lib/reportInputs";
import { applySupposedGradesForPriorTerms, parseReportInputs } from "@/lib/reportInputs";
import { getClassInTenant } from "@/lib/data/classesDb";
import { getRoleForTenant } from "@/lib/data/memberships";
import { getTenantDefaultReportLanguage } from "@/lib/data/tenantLanguage";
import { getStudentInTenant } from "@/lib/data/students";
import { translateReportComment } from "@/lib/ai/generateReportDraft";
import { getReport, updateReport } from "@/lib/data/reportsDb";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function GET(_req: Request, context: { params: Promise<{ tenantId: string; reportId: string }> }) {
  const { tenantId, reportId } = await context.params;
  if (!isUuid(tenantId) || !isUuid(reportId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (!role) return NextResponse.json({ error: "No access." }, { status: 403 });
  try {
    const report = await getReport(tenantId, reportId);
    if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    const student = await getStudentInTenant(tenantId, report.student_id);
    if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });
    const klass = await getClassInTenant(tenantId, student.class_id);
    if (klass && !canAccessClass({ role, viewerEmail: gate.email, klass })) {
      return NextResponse.json({ error: "You do not have access to this report." }, { status: 403 });
    }
    const tenant_default_report_language = await getTenantDefaultReportLanguage(tenantId);
    return NextResponse.json({
      report,
      student,
      class: klass,
      tenant_default_report_language,
      viewer_email: gate.email,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load report.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ tenantId: string; reportId: string }> }) {
  const { tenantId, reportId } = await context.params;
  if (!isUuid(tenantId) || !isUuid(reportId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (!role) return NextResponse.json({ error: "No access." }, { status: 403 });

  let body: {
    title?: unknown;
    body?: unknown;
    body_teacher_preview?: unknown;
    teacher_preview_language?: unknown;
    status?: unknown;
    output_language?: unknown;
    inputs?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const existing = await getReport(tenantId, reportId);
  if (!existing) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  const stu = await getStudentInTenant(tenantId, existing.student_id);
  if (!stu) return NextResponse.json({ error: "Student not found." }, { status: 404 });
  const klass = await getClassInTenant(tenantId, stu.class_id);
  if (klass && !canAccessClass({ role, viewerEmail: gate.email, klass })) {
    return NextResponse.json({ error: "You do not have access to this report." }, { status: 403 });
  }

  const patch: {
    title?: string | null;
    body?: string;
    body_teacher_preview?: string;
    teacher_preview_language?: ReportLanguageCode;
    status?: "draft" | "final";
    output_language?: ReportLanguageCode;
    inputs?: ReportInputs;
  } = {};
  if (typeof body.title === "string") patch.title = body.title.trim() || null;
  if (typeof body.body === "string") patch.body = body.body;
  if (typeof body.body_teacher_preview === "string") patch.body_teacher_preview = body.body_teacher_preview;
  if (typeof body.teacher_preview_language === "string") {
    const c = body.teacher_preview_language.trim();
    if (c && isReportLanguageCode(c)) patch.teacher_preview_language = c;
  }
  if (body.status === "draft" || body.status === "final") patch.status = body.status;
  if (typeof body.output_language === "string") {
    const c = body.output_language.trim();
    if (c && isReportLanguageCode(c)) patch.output_language = c;
  }
  if (body.inputs !== undefined) {
    patch.inputs = applySupposedGradesForPriorTerms(parseReportInputs(body.inputs));
  }

  const mergedBody = patch.body !== undefined ? patch.body : existing.body;
  const mergedOut: ReportLanguageCode = patch.output_language ?? existing.output_language;
  const mergedTeacherLang: ReportLanguageCode =
    patch.teacher_preview_language ?? existing.teacher_preview_language;

  const teacherLangChanged =
    patch.teacher_preview_language !== undefined && patch.teacher_preview_language !== existing.teacher_preview_language;
  const bodyChanged = patch.body !== undefined && patch.body !== existing.body;

  if (patch.body !== undefined && patch.body === "") {
    patch.body_teacher_preview = "";
  } else if (mergedBody.trim() && (teacherLangChanged || bodyChanged)) {
    if (mergedOut === mergedTeacherLang) {
      patch.body_teacher_preview = mergedBody;
    } else {
      try {
        const translated = await translateReportComment({
          text: mergedBody,
          fromLanguage: mergedOut,
          toLanguage: mergedTeacherLang,
        });
        patch.body_teacher_preview = translated.text;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Translation failed.";
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }
  }

  try {
    const report = await updateReport(tenantId, reportId, patch);
    return NextResponse.json({ report });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update report.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
