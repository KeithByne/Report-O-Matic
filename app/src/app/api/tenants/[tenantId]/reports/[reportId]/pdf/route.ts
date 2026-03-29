import { NextResponse } from "next/server";
import { canAccessClass } from "@/lib/auth/classAccess";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { getClassInTenant } from "@/lib/data/classesDb";
import { getRoleForTenant, getTenantName } from "@/lib/data/memberships";
import { getReport } from "@/lib/data/reportsDb";
import { downloadTenantLetterheadLogo } from "@/lib/data/tenantLetterheadLogo";
import { getTenantPdfLetterhead } from "@/lib/data/tenantPdfLetterhead";
import { isReportLanguageCode, languageLabel } from "@/lib/i18n/reportLanguages";
import { isUiLang, subjectLabelLocalized } from "@/lib/i18n/uiStrings";
import { buildLetterheadFromTenantSettings, buildReportPdfBuffer } from "@/lib/pdf/reportPdf";
import { resolvedSubjectCode } from "@/lib/reportInputs";
import { isSubjectCode } from "@/lib/subjects";
import { getServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function safeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "report";
}

export async function GET(req: Request, context: { params: Promise<{ tenantId: string; reportId: string }> }) {
  const { tenantId, reportId } = await context.params;
  if (!isUuid(tenantId) || !isUuid(reportId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  const inline = new URL(req.url).searchParams.get("inline") === "1";

  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (!role) return NextResponse.json({ error: "No access." }, { status: 403 });

  const report = await getReport(tenantId, reportId);
  if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });

  const { data: student, error: sErr } = await supabase
    .from("students")
    .select("display_name, class_id")
    .eq("id", report.student_id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (sErr || !student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  const st = student as { display_name: string; class_id: string };
  const klass = await getClassInTenant(tenantId, st.class_id);
  if (klass && !canAccessClass({ role, viewerEmail: gate.email, klass })) {
    return NextResponse.json({ error: "You do not have access to this report." }, { status: 403 });
  }
  const classDefault = klass?.default_subject && isSubjectCode(klass.default_subject) ? klass.default_subject : "efl";

  const tenantRecordName = (await getTenantName(tenantId)) || "School";
  const pdfLhRow = await getTenantPdfLetterhead(tenantId);
  const letterhead = buildLetterheadFromTenantSettings(tenantRecordName, pdfLhRow);
  const letterheadLogo = await downloadTenantLetterheadLogo(pdfLhRow.pdf_letterhead_logo_path);
  const outputLanguageCode =
    typeof report.output_language === "string" && isReportLanguageCode(report.output_language.trim())
      ? report.output_language.trim()
      : "en";
  const outputLanguageLabel = languageLabel(outputLanguageCode);
  const lang = isUiLang(outputLanguageCode) ? outputLanguageCode : "en";
  const subjectLabel = subjectLabelLocalized(lang, resolvedSubjectCode(report.inputs, classDefault));

  try {
    const buf = await buildReportPdfBuffer({
      letterhead,
      letterheadLogo,
      tenantRecordName,
      studentName: st.display_name,
      body: report.body || "",
      className: klass?.name ?? null,
      scholasticYear: klass?.scholastic_year ?? null,
      cefr: klass?.cefr_level ?? null,
      subjectLabel,
      reportPeriod: report.inputs.report_period,
      outputLanguageCode,
      outputLanguageLabel,
      reportTitle: report.title,
      inputs: report.inputs,
      generatedAt: new Date(),
    });
    const fname = safeFilename(`${st.display_name}-${reportId.slice(0, 8)}`) + ".pdf";
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${fname}"`,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "PDF failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
