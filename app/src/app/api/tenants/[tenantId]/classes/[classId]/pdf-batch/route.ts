import { NextResponse } from "next/server";
import { canAccessClass } from "@/lib/auth/classAccess";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { getClassInTenant } from "@/lib/data/classesDb";
import { getRoleForTenant, getTenantName } from "@/lib/data/memberships";
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
  const onlyFinal = url.searchParams.get("onlyFinal") === "1";
  const order = (url.searchParams.get("order") || "").trim().toLowerCase();

  const students = await listStudents(tenantId, classId);
  const studentById = new Map(students.map((s) => [s.id, s] as const));
  const studentOrder = new Map(students.map((s, i) => [s.id, i] as const));
  const reportsAll = await listReportsForTenant(tenantId);
  const allowedStudents = new Set(students.map((s) => s.id));
  let reports = reportsAll.filter((r) => allowedStudents.has(r.student_id));
  if (onlyFinal) reports = reports.filter((r) => r.status === "final");

  const nameOf = (rid: string) => (studentById.get(rid)?.display_name || "").toLowerCase();
  reports.sort((a, b) => {
    if (order === "updated_desc") return String(b.updated_at).localeCompare(String(a.updated_at));
    if (order === "updated_asc") return String(a.updated_at).localeCompare(String(b.updated_at));
    if (order === "student") return nameOf(a.student_id).localeCompare(nameOf(b.student_id));
    // default: class roster order
    const ai = studentOrder.get(a.student_id) ?? 9e9;
    const bi = studentOrder.get(b.student_id) ?? 9e9;
    if (ai !== bi) return ai - bi;
    return String(a.updated_at).localeCompare(String(b.updated_at));
  });

  const tenantRecordName = (await getTenantName(tenantId)) || "School";
  const pdfLhRow = await getTenantPdfLetterhead(tenantId);
  const letterhead = buildLetterheadFromTenantSettings(tenantRecordName, pdfLhRow);
  const letterheadLogo = await downloadTenantLetterheadLogo(pdfLhRow.pdf_letterhead_logo_path);

  const classDefault = klass.default_subject && isSubjectCode(klass.default_subject) ? klass.default_subject : "efl";

  const pdfs: Buffer[] = [];
  for (const r of reports) {
    const st = studentById.get(r.student_id);
    const studentName = st?.display_name ?? "Student";
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
      className: klass.name ?? null,
      scholasticYear: klass.scholastic_year ?? null,
      cefr: klass.cefr_level ?? null,
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

  if (pdfs.length === 0) {
    return NextResponse.json({ error: "No reports found for this class." }, { status: 404 });
  }

  const merged = await mergePdfBuffers(pdfs);
  const fname = safeFilename(`${klass.name || "class"}-reports`) + ".pdf";
  return new NextResponse(new Uint8Array(merged), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${fname}"`,
    },
  });
}

