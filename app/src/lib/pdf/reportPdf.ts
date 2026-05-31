import PDFDocument from "pdfkit";

import { metricDivisionLabelForRubric, metricLabelForRubric } from "@/lib/i18n/gradeRubricLabels";
import type { GradeRubricProfile } from "@/lib/gradeRubricProfile";
import { isUiLang, translate, type UiLang } from "@/lib/i18n/uiStrings";

import type { ReportInputs, ReportPeriod } from "@/lib/reportInputs";

import {
  DATASET4_METRICS,
  formatPercentSigFigs,
  isShortCourseReport,
  termAveragePercent,
  yearAveragePercent,
  type MetricDivisionKey,
} from "@/lib/reportInputs";

import { pdfTeacherSignatureLabel } from "@/lib/pdf/pdfTeacherSignature";

import {
  letterheadLogoFallbackDrawPt,
  letterheadLogoRenderPt,
  resolveLetterheadLogoDrawPt,
  type LetterheadLogoDrawPt,
} from "@/lib/pdf/letterheadLogoLayout";
import { formatLetterheadContactForPdf, letterheadContactLabelsForPdf } from "@/lib/pdf/letterheadContact";
import type { TenantPdfLetterheadRow } from "@/lib/data/tenantPdfLetterhead";

import {

  PDF_GRADES_TABLE_SPEC_V1,

  PDF_GRADES_DIVISION_BOX_V1,

  PDF_COMMENT_BOX_V1,

  PDF_MM_TO_PT,

  PDF_LETTERHEAD_LOGO_SPEC,

  letterheadColumnWidthsPt,

  PDF_PAGE_SPEC,

  PDF_SIGNATURE_BOX_HEIGHT_PT,

  PDF_TYPOGRAPHY_V1,

  REPORT_PDF_LAYOUT_VERSION,

  reportPdfLayoutKeywords,

} from "@/lib/pdf/reportPdfLayoutModel";



export {

  REPORT_PDF_LAYOUT_ID,

  REPORT_PDF_LAYOUT_MANIFEST_V1,

  REPORT_PDF_LAYOUT_VERSION,

} from "@/lib/pdf/reportPdfLayoutModel";

export type {

  ReportPdfLayoutManifest,

  ReportPdfPage1Section,

  ReportPdfPage2Section,

} from "@/lib/pdf/reportPdfLayoutModel";



/** Owner-configured letterhead (display strings already resolved). */

export type ReportPdfLetterhead = {

  displayName: string;

  tagline: string | null;

  address: string | null;

  contact: string | null;

};



export type ReportPdfContext = {

  letterhead: ReportPdfLetterhead;

  letterheadLogo: Buffer | null;

  tenantRecordName: string;

  studentName: string;

  body: string;

  className: string | null;

  scholasticYear: string | null;

  cefr: string | null;

  subjectLabel: string;

  reportPeriod: ReportPeriod;

  /** Report form “PDF / parents” language code (en, fr, es, …). */

  outputLanguageCode: string;

  outputLanguageLabel: string;

  reportTitle: string | null;

  inputs: ReportInputs;

  generatedAt: Date;

  gradeRubricProfile: GradeRubricProfile;

};



export function buildLetterheadFromTenantSettings(
  tenantName: string,
  row: Pick<
    TenantPdfLetterheadRow,
    | "pdf_letterhead_name"
    | "pdf_letterhead_tagline"
    | "pdf_letterhead_address"
    | "pdf_letterhead_contact"
    | "pdf_letterhead_contact_layout"
    | "pdf_letterhead_phone"
    | "pdf_letterhead_mobile"
    | "pdf_letterhead_email"
  >,
  lang: UiLang,
): ReportPdfLetterhead {
  const contact = formatLetterheadContactForPdf(
    {
      layout: row.pdf_letterhead_contact_layout,
      phone: row.pdf_letterhead_phone,
      mobile: row.pdf_letterhead_mobile,
      email: row.pdf_letterhead_email,
      legacyContact: row.pdf_letterhead_contact,
    },
    letterheadContactLabelsForPdf(lang),
  );

  return {
    displayName: row.pdf_letterhead_name?.trim() || tenantName,
    tagline: row.pdf_letterhead_tagline?.trim() || null,
    address: row.pdf_letterhead_address?.trim() || null,
    contact,
  };
}



function periodLabel(p: ReportPeriod, lang: UiLang): string {
  if (p === "first") return translate(lang, "report.termFirst");
  if (p === "second") return translate(lang, "report.termSecond");
  return translate(lang, "report.termThird");
}

function reportFocusLabel(inputs: ReportInputs, reportPeriod: ReportPeriod, lang: UiLang): string {
  if (isShortCourseReport(inputs)) return translate(lang, "pdf.shortCourseReportFocus");
  return periodLabel(reportPeriod, lang);
}



type PdfDoc = InstanceType<typeof PDFDocument>;



const { marginPt, widthPt, heightPt } = PDF_PAGE_SPEC;

const typo = PDF_TYPOGRAPHY_V1;

const tableSpec = PDF_GRADES_TABLE_SPEC_V1;

const divisionBoxSpec = PDF_GRADES_DIVISION_BOX_V1;

const commentBoxSpec = PDF_COMMENT_BOX_V1;

/** Mirrors `drawGradesTable` row advancement to detect whether the grid fits below the reserve without a page break. */
function gradesTableFitsOnePage(startY: number, visible: (typeof DATASET4_METRICS)[number][]): boolean {
  let y = startY + tableSpec.headerHeight;
  let currentDivision: MetricDivisionKey | "" = "";
  const limit = heightPt - marginPt - tableSpec.pageBreakReserve;
  for (const m of visible) {
    if (m.divisionKey !== currentDivision) {
      if (currentDivision !== "") {
        y += tableSpec.divisionBetweenBlocksPt;
      }
      currentDivision = m.divisionKey;
      y += tableSpec.rowHeight - 2;
    }
    y += tableSpec.rowHeight;
    if (y > limit) return false;
  }
  return true;
}

/** Vertical spans for each criteria division block (division heading + its metric rows), matching `drawGradesTable`. */
function computeDivisionBlockSegments(
  startY: number,
  visible: (typeof DATASET4_METRICS)[number][],
): { top: number; bottom: number }[] {
  let y = startY + tableSpec.headerHeight;
  let currentDivision: MetricDivisionKey | "" = "";
  let blockTop = -1;
  const segments: { top: number; bottom: number }[] = [];
  for (const m of visible) {
    if (m.divisionKey !== currentDivision) {
      if (currentDivision !== "" && blockTop >= 0) {
        segments.push({ top: blockTop, bottom: y });
        y += tableSpec.divisionBetweenBlocksPt;
      }
      currentDivision = m.divisionKey;
      blockTop = y;
      y += tableSpec.rowHeight - 2;
    }
    y += tableSpec.rowHeight;
  }
  if (currentDivision !== "" && blockTop >= 0) {
    segments.push({ top: blockTop, bottom: y });
  }
  return segments;
}

/** Rounded rectangles behind each criteria section (classroom behaviour, direct skills, indirect skills). */
function drawDivisionBlockBoxes(doc: PdfDoc, startY: number, usableW: number, visible: (typeof DATASET4_METRICS)[number][]): void {
  if (visible.length === 0 || !gradesTableFitsOnePage(startY, visible)) return;
  const segments = computeDivisionBlockSegments(startY, visible);
  const inset = divisionBoxSpec.insetPt;
  const x = marginPt + inset;
  const w = usableW - 2 * inset;
  const r = divisionBoxSpec.cornerRadiusPt;
  const pad = divisionBoxSpec.contentPaddingPt;
  doc.save();
  doc.lineWidth(divisionBoxSpec.strokeWidthPt).strokeColor(divisionBoxSpec.strokeColor).lineJoin("round");
  for (const seg of segments) {
    const h = seg.bottom - seg.top;
    if (h <= 0) continue;
    doc.roundedRect(x, seg.top - pad, w, h + 2 * pad, r).stroke();
  }
  doc.restore();
}

function applyTypo(

  doc: PdfDoc,

  t: { fontSize: number; font: "Helvetica" | "Helvetica-Bold"; fill: string },

): void {

  doc.fontSize(t.fontSize).fillColor(t.fill).font(t.font);

}

const LETTERHEAD_NAME_ADDR_GAP_PT = 4;
const LETTERHEAD_TAGLINE_BELOW_BASELINE_PT = 4;

function letterheadTextHeight(
  doc: PdfDoc,
  text: string,
  width: number,
  t: { fontSize: number; font: "Helvetica" | "Helvetica-Bold"; fill: string; lineGap?: number },
): number {
  applyTypo(doc, t);
  return doc.heightOfString(text, { width, lineGap: t.lineGap ?? 0 });
}



function drawLetterheadBlock(
  doc: PdfDoc,
  lh: ReportPdfLetterhead,
  logo: Buffer | null,
  pageMarginPt: number = marginPt,
  pageWidthPt: number = widthPt,
  logoDrawPt: LetterheadLogoDrawPt | null = null,
): void {

  /** Absolute page coords — start flush with the top margin (no extra flow offset). */
  const startY = pageMarginPt;

  doc.x = pageMarginPt;

  const leftX = pageMarginPt;

  const { contentWidthPt, logoColWidthPt, textColWidthPt, gapPt } = letterheadColumnWidthsPt(pageWidthPt, pageMarginPt);

  const hasLogo = Boolean(logo?.length);

  const drawBox = hasLogo ? (logoDrawPt ?? letterheadLogoFallbackDrawPt()) : null;

  const textX = hasLogo ? leftX + logoColWidthPt + gapPt : leftX;

  const textW = hasLogo ? textColWidthPt : contentWidthPt;

  const nameText = lh.displayName;

  const nameH = letterheadTextHeight(doc, nameText, textW, typo.letterheadName);

  const addrBlock = [lh.address?.trim(), lh.contact?.trim()].filter(Boolean).join("\n");

  const addrH = addrBlock ? letterheadTextHeight(doc, addrBlock, textW, typo.letterheadAddress) : 0;

  const textBlockH = nameH + (addrBlock ? LETTERHEAD_NAME_ADDR_GAP_PT + addrH : 0);

  const maxLogoH = heightPt * PDF_LETTERHEAD_LOGO_SPEC.maxPageHeightRatio;

  const logoRender =
    hasLogo && drawBox ? letterheadLogoRenderPt(drawBox, logoColWidthPt, maxLogoH) : { widthPt: 0, heightPt: 0 };

  const logoRH = logoRender.heightPt;

  /** Shared baseline: bottom of logo image and bottom of contact block (email line). */
  const cellH = Math.max(logoRH, textBlockH);

  const baselineY = startY + cellH;

  const textIsTaller = textBlockH >= logoRH;

  const textBlockY = textIsTaller ? startY : baselineY - textBlockH;

  const logoY = textIsTaller ? baselineY - logoRH : startY;



  if (hasLogo && logo && logoRH > 0) {

    try {

      doc.image(logo, leftX, logoY, { fit: [logoRender.widthPt, logoRH] });

    } catch {

      // skip

    }

  }



  applyTypo(doc, typo.letterheadName);

  doc.text(nameText, textX, textBlockY, { width: textW, align: "left" });

  if (addrBlock) {

    applyTypo(doc, typo.letterheadAddress);

    doc.text(addrBlock, textX, textBlockY + nameH + LETTERHEAD_NAME_ADDR_GAP_PT, {

      width: textW,

      align: "left",

      lineGap: typo.letterheadAddress.lineGap,

    });

  }



  const taglineText = lh.tagline?.trim() ?? "";

  let blockEndY = baselineY;

  if (taglineText) {

    const taglineH = letterheadTextHeight(doc, taglineText, logoColWidthPt, typo.letterheadTagline);

    const taglineY = baselineY + LETTERHEAD_TAGLINE_BELOW_BASELINE_PT;

    applyTypo(doc, typo.letterheadTagline);

    doc.text(taglineText, leftX, taglineY, {

      width: logoColWidthPt,

      align: "left",

      lineGap: typo.letterheadTagline.lineGap,

    });

    blockEndY = taglineY + taglineH;

  }



  doc.y = blockEndY;

  doc.x = pageMarginPt;

}



/** Same letterhead block as report PDFs; optional tighter horizontal margin for other documents (e.g. register). */

export function drawReportLetterhead(
  doc: PdfDoc,
  lh: ReportPdfLetterhead,
  logo: Buffer | null,
  opts?: { pageMarginPt?: number; pageWidthPt?: number; logoDrawPt?: LetterheadLogoDrawPt | null },
): void {
  drawLetterheadBlock(
    doc,
    lh,
    logo,
    opts?.pageMarginPt ?? marginPt,
    opts?.pageWidthPt ?? widthPt,
    opts?.logoDrawPt ?? null,
  );
}



function drawTeacherSignatureFoot(doc: PdfDoc, label: string): void {

  const usableW = widthPt - marginPt * 2;

  const boxH = PDF_SIGNATURE_BOX_HEIGHT_PT;

  const pageBottom = heightPt - marginPt;

  const boxTop = pageBottom - boxH;

  if (doc.y > boxTop - 14) {

    doc.addPage();

  }

  const pb = heightPt - marginPt;

  const bt = pb - boxH;

  doc.rect(marginPt, bt, usableW, boxH).strokeColor("#94a3b8").lineWidth(0.75).stroke();

  applyTypo(doc, typo.signatureLabel);

  doc.text(label, marginPt + 10, bt + 12, { width: usableW - 20 });

  doc.y = pb;

}



/** Metrics with at least one entered score (per term); empty cells are omitted from the row when the row is shown. */
function metricsApplicableForPdf(inputs: ReportInputs, shortCourse: boolean): (typeof DATASET4_METRICS)[number][] {
  return DATASET4_METRICS.filter((m) => {
    if (shortCourse) return inputs.terms[0][m.key] != null;
    return [0, 1, 2].some((ti) => inputs.terms[ti][m.key] != null);
  });
}

function drawGradesTable(
  doc: PdfDoc,
  inputs: ReportInputs,
  startY: number,
  lang: UiLang,
  rubric: GradeRubricProfile,
): number {
  const usableW = widthPt - marginPt * 2;
  const colLabelW = usableW * tableSpec.colLabelRatio;
  const shortCourse = isShortCourseReport(inputs);
  const colTermW = shortCourse ? usableW - colLabelW : (usableW - colLabelW) / 3;
  const x0 = marginPt;
  const x1 = x0 + colLabelW;
  const x2 = x1 + colTermW;
  const x3 = shortCourse ? x2 : x2 + colTermW;

  const termHeaders = [
    translate(lang, "pdf.gradesTerm1"),
    translate(lang, "pdf.gradesTerm2"),
    translate(lang, "pdf.gradesTerm3"),
  ] as const;
  const shortHeader = translate(lang, "pdf.gradesShortCourseCol");

  const visible = metricsApplicableForPdf(inputs, shortCourse);
  drawDivisionBlockBoxes(doc, startY, usableW, visible);

  let y = startY;
  const rowH = tableSpec.rowHeight;
  const headerH = tableSpec.headerHeight;

  applyTypo(doc, typo.gradesHeader);
  doc.text(translate(lang, "pdf.gradesColDimension"), x0, y, { width: colLabelW });
  if (shortCourse) {
    doc.text(shortHeader, x1, y, { width: colTermW, align: "center" });
  } else {
    doc.text(termHeaders[0], x1, y, { width: colTermW, align: "center" });
    doc.text(termHeaders[1], x2, y, { width: colTermW, align: "center" });
    doc.text(termHeaders[2], x3, y, { width: colTermW, align: "center" });
  }
  y += headerH;

  doc.font("Helvetica");
  let currentDivision: MetricDivisionKey | "" = "";
  for (const m of visible) {
    if (m.divisionKey !== currentDivision) {
      if (currentDivision !== "") {
        y += tableSpec.divisionSeparatorAbovePt;
        doc.save();
        doc
          .moveTo(marginPt, y)
          .lineTo(widthPt - marginPt, y)
          .strokeColor(typo.divider.stroke)
          .lineWidth(typo.divider.lineWidth)
          .stroke();
        doc.restore();
        y += tableSpec.divisionSeparatorBelowPt;
      }
      currentDivision = m.divisionKey;
      applyTypo(doc, typo.gradesDivision);
      const indentDivisionTitle = doc.widthOfString("n");
      doc.text(metricDivisionLabelForRubric(lang, m.divisionKey, rubric), x0 + indentDivisionTitle, y, {
        width: usableW - indentDivisionTitle,
      });
      y += rowH - 2;
      doc.font("Helvetica").fillColor(typo.gradesCellLabel.fill);
    }
    applyTypo(doc, typo.gradesCellLabel);
    const indentMetricRow = doc.widthOfString("n") * 2;
    doc.text(metricLabelForRubric(lang, m.key, rubric), x0 + indentMetricRow, y, {
      width: colLabelW - 4 - indentMetricRow,
    });
    const termCount = shortCourse ? 1 : 3;
    for (let ti = 0; ti < termCount; ti++) {
      const t = shortCourse ? 0 : ti;
      const v = inputs.terms[t][m.key];
      const cell = v === null || v === undefined ? "" : String(v);
      const xi = shortCourse ? x1 : ti === 0 ? x1 : ti === 1 ? x2 : x3;
      doc.text(cell, xi, y, { width: colTermW, align: "center" });
    }
    y += rowH;
    if (y > heightPt - marginPt - tableSpec.pageBreakReserve) {
      doc.addPage();
      y = marginPt;
    }
  }

  doc.x = marginPt;
  doc.y = y + 10;
  applyTypo(doc, typo.gradesFooter);
  const fmtPct = (pct: number | null) => (pct === null ? "—" : formatPercentSigFigs(pct, 2));
  if (shortCourse) {
    const pct = termAveragePercent(inputs.terms[0]);
    doc.text(
      translate(lang, "pdf.gradesShortCourseAverage", { term: shortHeader, value: fmtPct(pct) }),
    );
  } else {
    for (let t = 0; t < 3; t++) {
      const pct = termAveragePercent(inputs.terms[t]);
      doc.text(translate(lang, "pdf.gradesTermAverage", { term: termHeaders[t], value: fmtPct(pct) }));
    }
    const yearPct = yearAveragePercent(inputs);
    doc.text(translate(lang, "pdf.gradesYearAverage", { value: fmtPct(yearPct) }));
  }

  return doc.y;
}



export async function buildReportPdfBuffer(ctx: ReportPdfContext): Promise<Buffer> {
  if (REPORT_PDF_LAYOUT_VERSION !== 17) {
    return Promise.reject(new Error(`Unsupported report PDF layout version: ${REPORT_PDF_LAYOUT_VERSION}`));
  }
  const logoDrawPt = await resolveLetterheadLogoDrawPt(ctx.letterheadLogo, {
    pageWidthPt: widthPt,
    pageHeightPt: heightPt,
    pageMarginPt: marginPt,
  });
  return renderReportPdfLayoutV4(ctx, logoDrawPt);
}



/** Page 1: letterhead + context + academic record; page 2: parent comment only. */

function renderReportPdfLayoutV4(ctx: ReportPdfContext, logoDrawPt: LetterheadLogoDrawPt | null): Promise<Buffer> {

  return new Promise((resolve, reject) => {

    const lang: UiLang = isUiLang(ctx.outputLanguageCode) ? ctx.outputLanguageCode : "en";
    const pdfTitle =
      ctx.reportTitle?.trim() ||
      `${ctx.letterhead.displayName} — ${translate(lang, "pdf.defaultReportTitleSuffix")}`;

    const doc = new PDFDocument({

      size: "A4",

      margin: marginPt,

      info: {

        Title: pdfTitle,

        Author: ctx.letterhead.displayName,

        Subject: `${ctx.studentName} — ${ctx.subjectLabel}`,

        Keywords: reportPdfLayoutKeywords(),

      },

    });

    const chunks: Buffer[] = [];

    doc.on("data", (c: Buffer) => chunks.push(c));

    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.on("error", reject);



    const sigLabel = pdfTeacherSignatureLabel(ctx.outputLanguageCode);

    drawLetterheadBlock(doc, ctx.letterhead, ctx.letterheadLogo, marginPt, widthPt, logoDrawPt);

    doc.moveDown(0.55);



    if (ctx.reportTitle?.trim()) {

      applyTypo(doc, typo.reportSubtitle);

      doc.text(ctx.reportTitle.trim(), { align: "left", lineGap: 2 });

      doc.moveDown(0.35);

    }



    applyTypo(doc, typo.studentLine);

    doc.text(translate(lang, "pdf.studentLine", { name: ctx.studentName }), { align: "left" });

    doc.moveDown(0.6);



    applyTypo(doc, typo.metaLine);

    const metaLines: string[] = [];

    if (ctx.className) metaLines.push(translate(lang, "pdf.metaClass", { name: ctx.className }));

    if (ctx.scholasticYear)
      metaLines.push(translate(lang, "pdf.metaScholasticYear", { year: ctx.scholasticYear }));

    if (ctx.cefr) metaLines.push(translate(lang, "pdf.metaCefr", { level: ctx.cefr }));

    metaLines.push(translate(lang, "pdf.metaSubject", { subject: ctx.subjectLabel }));

    metaLines.push(
      `${translate(lang, "pdf.metaReportFocus")}: ${reportFocusLabel(ctx.inputs, ctx.reportPeriod, lang)}`,
    );

    metaLines.push(
      translate(lang, "pdf.metaReportLanguage", { label: ctx.outputLanguageLabel }),
    );

    doc.text(metaLines.join(" • "));

    doc.moveDown(0.7);



    doc

      .moveTo(marginPt, doc.y)

      .lineTo(widthPt - marginPt, doc.y)

      .strokeColor(typo.divider.stroke)

      .lineWidth(typo.divider.lineWidth)

      .stroke();

    doc.moveDown(0.65);



    applyTypo(doc, typo.gradesSectionTitle);

    doc.text(translate(lang, "pdf.gradesSectionTitle"), { align: "left" });

    doc.moveDown(0.65);

    drawGradesTable(doc, ctx.inputs, doc.y, lang, ctx.gradeRubricProfile);

    drawTeacherSignatureFoot(doc, sigLabel);



    doc.addPage();

    const narrative = ctx.body.trim() || translate(lang, "pdf.emptyParentComment");
    const page2UsableW = widthPt - marginPt * 2;
    const commentInnerPad = commentBoxSpec.innerMarginMm * PDF_MM_TO_PT;
    const textInnerW = page2UsableW - 2 * commentInnerPad;

    applyTypo(doc, typo.teacherCommentHeading);
    doc.text(translate(lang, "pdf.teacherCommentHeading"), marginPt, doc.y, {
      width: page2UsableW,
      underline: true,
    });
    doc.moveDown(0.55);

    const commentBoxTop = doc.y;
    applyTypo(doc, typo.narrative);
    const commentTextHeight = doc.heightOfString(narrative, {
      width: textInnerW,
      lineGap: typo.narrative.lineGap,
    });
    const commentBoxH = commentTextHeight + 2 * commentInnerPad;

    doc.save();
    doc
      .lineWidth(commentBoxSpec.strokeWidthPt)
      .strokeColor(commentBoxSpec.strokeColor)
      .lineJoin("round")
      .roundedRect(marginPt, commentBoxTop, page2UsableW, commentBoxH, commentBoxSpec.cornerRadiusPt)
      .stroke();
    doc.restore();

    doc.text(narrative, marginPt + commentInnerPad, commentBoxTop + commentInnerPad, {
      width: textInnerW,
      lineGap: typo.narrative.lineGap,
    });
    doc.y = commentBoxTop + commentBoxH;

    doc.moveDown(1);

    drawTeacherSignatureFoot(doc, sigLabel);



    doc.end();

  });

}

