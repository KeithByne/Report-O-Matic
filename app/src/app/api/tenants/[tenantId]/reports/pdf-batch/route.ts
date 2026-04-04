import { NextResponse } from "next/server";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { getRoleForTenant, getTenantName } from "@/lib/data/memberships";
import { listClasses } from "@/lib/data/classesDb";
import { listReportsForTenant, type ReportRow } from "@/lib/data/reportsDb";
import { listStudents } from "@/lib/data/students";
import { downloadTenantLetterheadLogo } from "@/lib/data/tenantLetterheadLogo";
import { getTenantPdfLetterhead } from "@/lib/data/tenantPdfLetterhead";
import { languageLabel } from "@/lib/i18n/reportLanguages";
import { isUiLang, subjectLabelLocalized } from "@/lib/i18n/uiStrings";
import { buildLetterheadFromTenantSettings, buildReportPdfBuffer } from "@/lib/pdf/reportPdf";
import { mergePdfBuffers } from "@/lib/pdf/mergePdf";
import {
  parseClassBulkPdfTermFilter,
  reportReadyForClassBulkPdf,
  resolvedSubjectCode,
  type ReportPeriod,
} from "@/lib/reportInputs";
import { isSubjectCode } from "@/lib/subjects";

export const runtime = "nodejs";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function safeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "reports";
}

const GROUP_MODES = new Set(["term", "teacher", "class", "student"]);

function termRank(r: ReportRow): number {
  const p = r.inputs.report_period;
  if (p === "first") return 0;
  if (p === "second") return 1;
  if (p === "third") return 2;
  return 3;
}

function compareReportsForGroup(
  a: ReportRow,
  b: ReportRow,
  group: string,
  ctx: {
    studentNameOf: (id: string) => string;
    classNameOfReport: (r: ReportRow) => string;
    authorOf: (r: ReportRow) => string;
  },
): number {
  const { studentNameOf, classNameOfReport, authorOf } = ctx;
  const sa = studentNameOf(a.student_id);
  const sb = studentNameOf(b.student_id);
  const ca = classNameOfReport(a);
  const cb = classNameOfReport(b);
  const ta = authorOf(a);
  const tb = authorOf(b);
  const ra = termRank(a);
  const rb = termRank(b);

  if (group === "term") {
    if (ra !== rb) return ra - rb;
    let c = ta.localeCompare(tb);
    if (c !== 0) return c;
    c = ca.localeCompare(cb);
    if (c !== 0) return c;
    return sa.localeCompare(sb);
  }
  if (group === "teacher") {
    let c = ta.localeCompare(tb);
    if (c !== 0) return c;
    if (ra !== rb) return ra - rb;
    c = ca.localeCompare(cb);
    if (c !== 0) return c;
    return sa.localeCompare(sb);
  }
  if (group === "class") {
    let c = ca.localeCompare(cb);
    if (c !== 0) return c;
    if (ra !== rb) return ra - rb;
    c = ta.localeCompare(tb);
    if (c !== 0) return c;
    return sa.localeCompare(sb);
  }
  if (group === "student") {
    let c = sa.localeCompare(sb);
    if (c !== 0) return c;
    if (ra !== rb) return ra - rb;
    c = ca.localeCompare(cb);
    if (c !== 0) return c;
    return ta.localeCompare(tb);
  }
  return String(b.updated_at).localeCompare(String(a.updated_at));
}

export async function GET(req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });

  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (!role) return NextResponse.json({ error: "No access." }, { status: 403 });

  const url = new URL(req.url);
  const inline = url.searchParams.get("inline") === "1";
  const onlyFinal = url.searchParams.get("onlyFinal") === "1";
  const orderRaw = (url.searchParams.get("order") || "").trim().toLowerCase();
  const group = GROUP_MODES.has(orderRaw) ? orderRaw : "term";
  const termFilter = parseClassBulkPdfTermFilter(url.searchParams.get("term"));
  const classTermNotReadyMsg = "Every pupil needs a finished report for the selected term.";

  const classes = await listClasses(tenantId, { viewerRole: role, viewerEmail: gate.email });
  const classById = new Map(classes.map((c) => [c.id, c] as const));
  const classIds = classes.map((c) => c.id);
  const students = classIds.length ? await listStudents(tenantId, undefined, { classIds }) : [];
  const studentById = new Map(students.map((s) => [s.id, s] as const));

  let reports = await listReportsForTenant(tenantId);
  const allowedStudents = new Set(students.map((s) => s.id));
  reports = reports.filter((r) => allowedStudents.has(r.student_id));

  if (role === "teacher") {
    const me = gate.email.trim().toLowerCase();
    reports = reports.filter((r) => r.author_email.trim().toLowerCase() === me);
  }

  if (onlyFinal) reports = reports.filter((r) => r.status === "final");

  const rowReady = (r: ReportRow) =>
    reportReadyForClassBulkPdf({ status: r.status, body: r.body, inputs: r.inputs });

  if (termFilter !== "all") {
    const period = termFilter as ReportPeriod;
    const toMerge = reports.filter((r) => rowReady(r) && r.inputs.report_period === period);
    for (const s of students) {
      if (!toMerge.some((r) => r.student_id === s.id)) {
        return NextResponse.json({ error: classTermNotReadyMsg }, { status: 409 });
      }
    }
    reports = toMerge;
  }

  const studentNameOf = (studentId: string) => (studentById.get(studentId)?.display_name || "").toLowerCase();
  const classNameOfReport = (r: ReportRow) => {
    const st = studentById.get(r.student_id);
    const k = st ? classById.get(st.class_id) : null;
    return (k?.name ?? "").toLowerCase();
  };
  const authorOf = (r: ReportRow) => r.author_email.trim().toLowerCase();

  reports.sort((a, b) => compareReportsForGroup(a, b, group, { studentNameOf, classNameOfReport, authorOf }));

  if (reports.length === 0) {
    return NextResponse.json({ error: "No reports found." }, { status: 404 });
  }

  const tenantRecordName = (await getTenantName(tenantId)) || "School";
  const pdfLhRow = await getTenantPdfLetterhead(tenantId);
  const letterhead = buildLetterheadFromTenantSettings(tenantRecordName, pdfLhRow);
  const letterheadLogo = await downloadTenantLetterheadLogo(pdfLhRow.pdf_letterhead_logo_path);

  const pdfs: Buffer[] = [];
  for (const r of reports) {
    const st = studentById.get(r.student_id);
    const studentName = st?.display_name ?? "Student";
    const klass = st ? classById.get(st.class_id) : null;
    const classDefault =
      klass?.default_subject && isSubjectCode(klass.default_subject) ? klass.default_subject : "efl";

    const outputLanguageCode = r.output_language;
    const outputLanguageLabel = languageLabel(outputLanguageCode);
    const lang = isUiLang(outputLanguageCode) ? outputLanguageCode : "en";
    const subjectLabel = subjectLabelLocalized(lang, resolvedSubjectCode(r.inputs, classDefault));

    const buf = await buildReportPdfBuffer({
      letterhead,
      letterheadLogo,
      tenantRecordName,
      studentName,
      body: r.body || "",
      className: klass?.name ?? null,
      scholasticYear: klass?.scholastic_year ?? null,
      cefr: klass?.cefr_level ?? null,
      subjectLabel,
      reportPeriod: r.inputs.report_period,
      outputLanguageCode,
      outputLanguageLabel,
      reportTitle: r.title,
      inputs: r.inputs,
      generatedAt: new Date(r.updated_at || Date.now()),
    });
    pdfs.push(buf);
  }

  const merged = await mergePdfBuffers(pdfs);
  const fname =
    safeFilename(termFilter !== "all" ? `bulk-reports-${termFilter}` : "bulk-reports") + ".pdf";
  return new NextResponse(new Uint8Array(merged), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${fname}"`,
    },
  });
}
