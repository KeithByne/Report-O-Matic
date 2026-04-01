import PDFDocument from "pdfkit";

import { isReportLanguageCode, UI_LOCALE_BCP47 } from "@/lib/i18n/reportLanguages";

import { isUiLang, metricDivisionLabel, metricLabel, translate, type UiLang } from "@/lib/i18n/uiStrings";

import type { MetricDivisionKey, ReportInputs, ReportPeriod } from "@/lib/reportInputs";

import { DATASET4_METRICS, termAveragePercent } from "@/lib/reportInputs";

import { pdfTeacherSignatureLabel } from "@/lib/pdf/pdfTeacherSignature";

import {

  PDF_GRADES_TABLE_SPEC_V1,

  PDF_LETTERHEAD_BLOCK_SPEC_V1,

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

};



export function buildLetterheadFromTenantSettings(

  tenantName: string,

  row: {

    pdf_letterhead_name: string | null;

    pdf_letterhead_tagline: string | null;

    pdf_letterhead_address: string | null;

    pdf_letterhead_contact: string | null;

  },

): ReportPdfLetterhead {

  return {

    displayName: row.pdf_letterhead_name?.trim() || tenantName,

    tagline: row.pdf_letterhead_tagline?.trim() || null,

    address: row.pdf_letterhead_address?.trim() || null,

    contact: row.pdf_letterhead_contact?.trim() || null,

  };

}



function periodLabel(p: ReportPeriod, lang: UiLang): string {
  if (p === "first") return translate(lang, "report.termFirst");
  if (p === "second") return translate(lang, "report.termSecond");
  return translate(lang, "report.termThird");
}



function fmtDate(d: Date, outputLangCode: string): string {

  const code = isReportLanguageCode(outputLangCode) ? outputLangCode : "en";

  const loc = UI_LOCALE_BCP47[code];

  try {

    return d.toLocaleString(loc, { dateStyle: "medium", timeStyle: "short" });

  } catch {

    return d.toISOString();

  }

}



type PdfDoc = InstanceType<typeof PDFDocument>;



const { marginPt, widthPt, heightPt } = PDF_PAGE_SPEC;

const lhSpec = PDF_LETTERHEAD_BLOCK_SPEC_V1;

const typo = PDF_TYPOGRAPHY_V1;

const tableSpec = PDF_GRADES_TABLE_SPEC_V1;



function applyTypo(

  doc: PdfDoc,

  t: { fontSize: number; font: "Helvetica" | "Helvetica-Bold"; fill: string },

): void {

  doc.fontSize(t.fontSize).fillColor(t.fill).font(t.font);

}



function drawLetterheadBlock(
  doc: PdfDoc,
  lh: ReportPdfLetterhead,
  logo: Buffer | null,
  pageMarginPt: number = marginPt,
): void {

  const startY = doc.y;

  const leftX = pageMarginPt;

  const slotW = lhSpec.logoSlotWidthPt;

  const slotH = lhSpec.logoSlotHeightPt;

  const textX = leftX + slotW + lhSpec.columnGapPt;

  const textW = widthPt - pageMarginPt - textX;



  const hasLogo = Boolean(logo?.length);

  if (hasLogo && logo) {

    try {

      doc.image(logo, leftX, startY, { fit: [slotW, slotH] });

    } catch {

      // skip

    }

  }



  const logoBottom = startY + (hasLogo ? slotH : 0);



  let tagBottom = startY;

  if (lh.tagline?.trim()) {

    const tagY = hasLogo ? logoBottom + 6 : startY;

    applyTypo(doc, typo.letterheadTagline);

    doc.text(lh.tagline.trim(), leftX, tagY, {

      width: slotW,

      align: "left",

      lineGap: typo.letterheadTagline.lineGap,

    });

    tagBottom = doc.y;

  } else if (hasLogo) {

    tagBottom = logoBottom;

  }



  applyTypo(doc, typo.letterheadName);

  doc.text(lh.displayName, textX, startY, { width: textW, align: "left" });

  let textBottom = doc.y;

  const addrBlock = [lh.address?.trim(), lh.contact?.trim()].filter(Boolean).join("\n");

  if (addrBlock) {

    applyTypo(doc, typo.letterheadAddress);

    doc.text(addrBlock, textX, textBottom + 4, {

      width: textW,

      align: "left",

      lineGap: typo.letterheadAddress.lineGap,

    });

    textBottom = doc.y;

  }



  const leftColumnEnd = lh.tagline?.trim() ? tagBottom : hasLogo ? logoBottom : startY;

  const blockEnd = Math.max(leftColumnEnd, textBottom);

  doc.y = blockEnd;

  doc.x = pageMarginPt;

}



/** Same letterhead block as report PDFs; optional tighter horizontal margin for other documents (e.g. register). */

export function drawReportLetterhead(
  doc: PdfDoc,
  lh: ReportPdfLetterhead,
  logo: Buffer | null,
  opts?: { pageMarginPt?: number },
): void {
  drawLetterheadBlock(doc, lh, logo, opts?.pageMarginPt ?? marginPt);
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



function drawGradesTable(doc: PdfDoc, inputs: ReportInputs, startY: number, lang: UiLang): number {
  const usableW = widthPt - marginPt * 2;
  const colLabelW = usableW * tableSpec.colLabelRatio;
  const colTermW = (usableW - colLabelW) / 3;
  const x0 = marginPt;
  const x1 = x0 + colLabelW;
  const x2 = x1 + colTermW;
  const x3 = x2 + colTermW;

  const termHeaders = [
    translate(lang, "pdf.gradesTerm1"),
    translate(lang, "pdf.gradesTerm2"),
    translate(lang, "pdf.gradesTerm3"),
  ] as const;

  let y = startY;
  const rowH = tableSpec.rowHeight;
  const headerH = tableSpec.headerHeight;

  applyTypo(doc, typo.gradesHeader);
  doc.text(translate(lang, "pdf.gradesColDimension"), x0, y, { width: colLabelW });
  doc.text(termHeaders[0], x1, y, { width: colTermW, align: "center" });
  doc.text(termHeaders[1], x2, y, { width: colTermW, align: "center" });
  doc.text(termHeaders[2], x3, y, { width: colTermW, align: "center" });
  y += headerH;

  doc.font("Helvetica");
  let currentDivision: MetricDivisionKey | "" = "";
  for (const m of DATASET4_METRICS) {
    if (m.divisionKey !== currentDivision) {
      currentDivision = m.divisionKey;
      applyTypo(doc, typo.gradesDivision);
      doc.text(metricDivisionLabel(lang, m.divisionKey), x0, y, { width: usableW });
      y += rowH - 2;
      doc.font("Helvetica").fillColor(typo.gradesCellLabel.fill);
    }
    doc.fontSize(typo.gradesCellLabel.fontSize);
    doc.text(metricLabel(lang, m.key), x0, y, { width: colLabelW - 4 });
    for (let t = 0; t < 3; t++) {
      const v = inputs.terms[t][m.key];
      const cell = v === null || v === undefined ? "—" : String(v);
      const xi = t === 0 ? x1 : t === 1 ? x2 : x3;
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
  for (let t = 0; t < 3; t++) {
    const pct = termAveragePercent(inputs.terms[t]);
    const valueStr = pct === null ? "—" : `${pct.toFixed(2)}%`;
    doc.text(translate(lang, "pdf.gradesTermAverage", { term: termHeaders[t], value: valueStr }));
  }

  return doc.y;
}



export function buildReportPdfBuffer(ctx: ReportPdfContext): Promise<Buffer> {
  if (REPORT_PDF_LAYOUT_VERSION !== 7) {
    return Promise.reject(new Error(`Unsupported report PDF layout version: ${REPORT_PDF_LAYOUT_VERSION}`));
  }
  return renderReportPdfLayoutV4(ctx);
}



/** Page 1: letterhead + context + academic record; page 2: parent comment only. */

function renderReportPdfLayoutV4(ctx: ReportPdfContext): Promise<Buffer> {

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

    drawLetterheadBlock(doc, ctx.letterhead, ctx.letterheadLogo);

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

    metaLines.push(`${translate(lang, "pdf.metaReportFocus")}: ${periodLabel(ctx.reportPeriod, lang)}`);

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

    doc.moveDown(0.25);

    applyTypo(doc, typo.gradesSectionIntro);

    doc.text(translate(lang, "pdf.gradesSectionIntro"), {
      align: "left",
      lineGap: typo.gradesSectionIntro.lineGap,
    });

    doc.moveDown(0.65);

    drawGradesTable(doc, ctx.inputs, doc.y, lang);

    drawTeacherSignatureFoot(doc, sigLabel);



    doc.addPage();

    const narrative = ctx.body.trim() || translate(lang, "pdf.emptyParentComment");

    applyTypo(doc, typo.narrative);

    doc.text(narrative, {

      align: "left",

      lineGap: typo.narrative.lineGap,

    });



    doc.moveDown(1);

    applyTypo(doc, typo.generatedStamp);

    doc.text(
      translate(lang, "pdf.generatedStamp", { datetime: fmtDate(ctx.generatedAt, ctx.outputLanguageCode) }),
      { align: "center" },
    );



    drawTeacherSignatureFoot(doc, sigLabel);



    doc.end();

  });

}

