import { NextResponse } from "next/server";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { getTenantName } from "@/lib/data/memberships";
import { downloadTenantLetterheadLogo } from "@/lib/data/tenantLetterheadLogo";
import { getTenantPdfLetterhead } from "@/lib/data/tenantPdfLetterhead";
import { getTenantDefaultReportLanguage } from "@/lib/data/tenantLanguage";
import { isReportLanguageCode, languageLabel } from "@/lib/i18n/reportLanguages";
import { isUiLang, subjectLabelLocalized, translate } from "@/lib/i18n/uiStrings";
import { buildLetterheadFromTenantSettings, buildReportPdfBuffer } from "@/lib/pdf/reportPdf";
import { emptyReportInputs } from "@/lib/reportInputs";

export const runtime = "nodejs";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/** Sample PDF for letterhead + layout preview (no real student). */
export async function GET(req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const inline = new URL(req.url).searchParams.get("inline") === "1";

  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;

  const tenantRecordName = (await getTenantName(tenantId)) || "School";
  const pdfLhRow = await getTenantPdfLetterhead(tenantId);
  const letterhead = buildLetterheadFromTenantSettings(tenantRecordName, pdfLhRow);
  const letterheadLogo = await downloadTenantLetterheadLogo(pdfLhRow.pdf_letterhead_logo_path);
  const inputs = emptyReportInputs();

  const urlLang = new URL(req.url).searchParams.get("lang")?.trim();
  const outputLanguageCode =
    urlLang && isReportLanguageCode(urlLang) ? urlLang : await getTenantDefaultReportLanguage(tenantId);
  const outputLanguageLabel = languageLabel(outputLanguageCode);
  const lang = isUiLang(outputLanguageCode) ? outputLanguageCode : "en";

  try {
    const buf = await buildReportPdfBuffer({
      letterhead,
      letterheadLogo,
      tenantRecordName,
      studentName: translate(lang, "pdf.sampleStudentName"),
      body: translate(lang, "pdf.sampleCommentBody"),
      className: translate(lang, "pdf.sampleClassName"),
      scholasticYear: "2025 – 2026",
      cefr: "B1",
      subjectLabel: subjectLabelLocalized(lang, "efl"),
      reportPeriod: "first",
      outputLanguageCode,
      outputLanguageLabel,
      reportTitle: null,
      inputs,
      generatedAt: new Date(),
    });
    const fname = `sample-report-${tenantId.slice(0, 8)}.pdf`;
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
