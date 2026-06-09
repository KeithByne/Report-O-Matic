import { NextResponse } from "next/server";
import { canAccessClass } from "@/lib/auth/classAccess";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { getClassInTenant } from "@/lib/data/classesDb";
import { getRoleForTenant, getTenantName } from "@/lib/data/memberships";
import { listReportsForTenant } from "@/lib/data/reportsDb";
import { resolveGradeRubricForTenantReport } from "@/lib/data/resolveGradeRubricForTenantReport";
import { listStudents } from "@/lib/data/students";
import { downloadTenantLetterheadLogoForPdf } from "@/lib/data/tenantLetterheadLogo";
import { getTenantPdfLetterhead } from "@/lib/data/tenantPdfLetterhead";
import { languageLabel } from "@/lib/i18n/reportLanguages";
import { isUiLang, resolvedSubjectLabelForPdf } from "@/lib/i18n/uiStrings";
import { resolveReportInputsForPdf } from "@/lib/data/priorReportGradesForAi";
import { buildLetterheadFromTenantSettings, buildReportPdfBuffer } from "@/lib/pdf/reportPdf";
import { getServiceSupabase } from "@/lib/supabase/service";
import { pdfExportResponse } from "@/lib/credits/exportPdf";
import { mergePdfBuffers } from "@/lib/pdf/mergePdf";
import { parseClassBulkPdfTermFilter, pickClassBulkReportRowForPeriod, type ReportPeriod } from "@/lib/reportInputs";
import {
  bulkPdfIncompleteResponse,
  listClassBulkPdfIncompleteAll,
  listClassBulkPdfIncompleteForTerm,
} from "@/lib/bulkPdfIncomplete";
import { coerceStoredDefaultSubject } from "@/lib/subjects";

export const runtime = "nodejs";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function safeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "reports";
}

export async function GET(req: Request, context: { params: Promise<{ tenantId: string; classId: string }> }) {
  const { tenantId, classId } = await context.params;
  if (!isUuid(tenantId) || !isUuid(classId)) return NextResponse.json({ error: "Invalid id." }, { status: 400 });

  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (!role) return NextResponse.json({ error: "No access." }, { status: 403 });

  const klass = await getClassInTenant(tenantId, classId);
  if (!klass) return NextResponse.json({ error: "Class not found." }, { status: 404 });
  if (!canAccessClass({ role, viewerEmail: gate.email, klass })) {
    return NextResponse.json({ error: "You do not have access to this class." }, { status: 403 });
  }

  const url = new URL(req.url);
  const inline = url.searchParams.get("inline") === "1";
  const order = (url.searchParams.get("order") || "").trim().toLowerCase();
  const termFilter = parseClassBulkPdfTermFilter(url.searchParams.get("term"));
  const anyStatus = url.searchParams.get("anyStatus") === "1";

  const classNotFinishedMsg =
    "You can't download all the class reports until they are all finished.";
  const classTermNotReadyMsg = "Every pupil needs a finished report for the selected term.";

  const students = await listStudents(tenantId, classId);
  if (students.length === 0) {
    return NextResponse.json({ error: "No pupils in this class." }, { status: 404 });
  }
  const studentById = new Map(students.map((s) => [s.id, s] as const));
  const studentOrder = new Map(students.map((s, i) => [s.id, i] as const));
  const reportsAll = await listReportsForTenant(tenantId);
  const allowedStudents = new Set(students.map((s) => s.id));
  const reports = reportsAll.filter((r) => allowedStudents.has(r.student_id));

  const me = gate.email.trim().toLowerCase();
  let toMerge: typeof reports;

  if (role === "teacher" && anyStatus && termFilter === "all") {
    toMerge = reports.filter((r) => r.author_email.trim().toLowerCase() === me);
    if (toMerge.length === 0) {
      return NextResponse.json({ error: "No reports found for this class." }, { status: 404 });
    }
  } else {
    if (termFilter === "all") {
      const incomplete = listClassBulkPdfIncompleteAll(students, reports);
      if (incomplete.length > 0) {
        return NextResponse.json(bulkPdfIncompleteResponse(classNotFinishedMsg, incomplete), { status: 409 });
      }
      toMerge = reports;
    } else {
      const period: ReportPeriod = termFilter;
      const incomplete = listClassBulkPdfIncompleteForTerm(students, reports, period);
      if (incomplete.length > 0) {
        return NextResponse.json(bulkPdfIncompleteResponse(classTermNotReadyMsg, incomplete), { status: 409 });
      }
      toMerge = students.map((s) => pickClassBulkReportRowForPeriod(reports, s.id, period)!);
    }
  }

  const nameOf = (rid: string) => (studentById.get(rid)?.display_name || "").toLowerCase();
  toMerge.sort((a, b) => {
    if (order === "updated_desc") return String(b.updated_at).localeCompare(String(a.updated_at));
    if (order === "updated_asc") return String(a.updated_at).localeCompare(String(b.updated_at));
    if (order === "student") return nameOf(a.student_id).localeCompare(nameOf(b.student_id));
    // default: class roster order
    const ai = studentOrder.get(a.student_id) ?? 9e9;
    const bi = studentOrder.get(b.student_id) ?? 9e9;
    if (ai !== bi) return ai - bi;
    return String(a.updated_at).localeCompare(String(b.updated_at));
  });

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });

  const tenantRecordName = (await getTenantName(tenantId)) || "School";
  const pdfLhRow = await getTenantPdfLetterhead(tenantId);
  const letterheadLogo = await downloadTenantLetterheadLogoForPdf(pdfLhRow.pdf_letterhead_logo_path);

  const classDefault = coerceStoredDefaultSubject(klass.default_subject);

  const pdfs: Buffer[] = [];
  for (const r of toMerge) {
    const st = studentById.get(r.student_id);
    const studentName = st?.display_name ?? "Student";
    const outputLanguageCode = r.output_language;
    const outputLanguageLabel = languageLabel(outputLanguageCode);
    const lang = isUiLang(outputLanguageCode) ? outputLanguageCode : "en";
    const letterhead = buildLetterheadFromTenantSettings(tenantRecordName, pdfLhRow, lang);
    const subjectLabel = resolvedSubjectLabelForPdf(lang, r.inputs, classDefault);
    const gradeRubricProfile = await resolveGradeRubricForTenantReport(
      tenantId,
      r.inputs,
      classDefault,
      klass.grade_rubric_profile,
    );

    const bodyResolved = (r.body || "").trim() ? r.body : (r.body_teacher_preview || "");
    const reportPeriodResolved: ReportPeriod = termFilter === "all" ? r.inputs.report_period : (termFilter as ReportPeriod);

    const inputsForPdf = await resolveReportInputsForPdf(supabase, {
      tenantId,
      studentId: r.student_id,
      reportId: r.id,
      inputs: r.inputs,
      classScholasticYear: klass.scholastic_year ?? null,
    });

    const buf = await buildReportPdfBuffer({
      letterhead,
      letterheadLogo,
      tenantRecordName,
      studentName,
      body: bodyResolved || "",
      className: klass.name ?? null,
      scholasticYear: klass.scholastic_year ?? null,
      cefr: klass.cefr_level ?? null,
      subjectLabel,
      reportPeriod: reportPeriodResolved,
      outputLanguageCode,
      outputLanguageLabel,
      reportTitle: r.title,
      inputs: inputsForPdf,
      generatedAt: new Date(r.updated_at || Date.now()),
      gradeRubricProfile,
    });
    pdfs.push(buf);
  }

  if (pdfs.length === 0) {
    return NextResponse.json({ error: "No reports found for this class." }, { status: 404 });
  }

  const merged = await mergePdfBuffers(pdfs);
  const fileStem =
    termFilter === "all"
      ? `${klass.name || "class"}-reports`
      : `${klass.name || "class"}-reports-${termFilter}`;
  const fname = safeFilename(fileStem) + ".pdf";
  return pdfExportResponse(tenantId, merged, { inline, filename: fname });
}
