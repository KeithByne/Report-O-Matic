import { NextResponse } from "next/server";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { getRoleForTenant, getTenantName } from "@/lib/data/memberships";
import { listClasses } from "@/lib/data/classesDb";
import { listReportsForTenant } from "@/lib/data/reportsDb";
import { listStudents } from "@/lib/data/students";
import { downloadTenantLetterheadLogo } from "@/lib/data/tenantLetterheadLogo";
import { getTenantPdfLetterhead } from "@/lib/data/tenantPdfLetterhead";
import { languageLabel } from "@/lib/i18n/reportLanguages";
import { isUiLang, subjectLabelLocalized } from "@/lib/i18n/uiStrings";
import { buildLetterheadFromTenantSettings, buildReportPdfBuffer } from "@/lib/pdf/reportPdf";
import { mergePdfBuffers } from "@/lib/pdf/mergePdf";
import { resolvedSubjectCode } from "@/lib/reportInputs";
import { isSubjectCode } from "@/lib/subjects";

export const runtime = "nodejs";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function safeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "reports";
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
  const authorRaw = url.searchParams.get("author")?.trim().toLowerCase() || "";
  const order = (url.searchParams.get("order") || "").trim().toLowerCase();

  // Teachers can only batch-download their own authored reports.
  const author =
    role === "teacher"
      ? gate.email.trim().toLowerCase()
      : authorRaw && authorRaw.includes("@")
        ? authorRaw
        : gate.email.trim().toLowerCase();

  // Visibility: teachers only see their assigned classes; owners/DH see all.
  const classes = await listClasses(tenantId, { viewerRole: role, viewerEmail: gate.email });
  const classById = new Map(classes.map((c) => [c.id, c] as const));
  const classIds = classes.map((c) => c.id);
  const students = classIds.length ? await listStudents(tenantId, undefined, { classIds }) : [];
  const studentById = new Map(students.map((s) => [s.id, s] as const));

  let reports = await listReportsForTenant(tenantId);
  const allowedStudents = new Set(students.map((s) => s.id));
  reports = reports.filter((r) => allowedStudents.has(r.student_id));
  reports = reports.filter((r) => r.author_email.trim().toLowerCase() === author);
  if (onlyFinal) reports = reports.filter((r) => r.status === "final");

  const studentNameOf = (studentId: string) => (studentById.get(studentId)?.display_name || "").toLowerCase();
  reports.sort((a, b) => {
    if (order === "updated_asc") return String(a.updated_at).localeCompare(String(b.updated_at));
    if (order === "student") return studentNameOf(a.student_id).localeCompare(studentNameOf(b.student_id));
    // default: newest first
    return String(b.updated_at).localeCompare(String(a.updated_at));
  });

  if (reports.length === 0) {
    return NextResponse.json({ error: "No reports found for this teacher." }, { status: 404 });
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
  const fname = safeFilename(`${author}-reports`) + ".pdf";
  return new NextResponse(new Uint8Array(merged), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${fname}"`,
    },
  });
}

