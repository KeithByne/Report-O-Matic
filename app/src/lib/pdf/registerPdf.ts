import PDFDocument from "pdfkit";
import type { WeekdayKey } from "@/lib/activeWeekdays";
import { isUiLang, translate, type UiLang } from "@/lib/i18n/uiStrings";
import { PDF_PAGE_SPEC } from "@/lib/pdf/reportPdfLayoutModel";
import { drawReportLetterhead, type ReportPdfLetterhead } from "@/lib/pdf/reportPdf";

const REGISTER_MARGIN_PT = 28;
const ROWS_PER_PAGE = 20;
/** Body: first / last name columns — 10pt Helvetica. */
const NAME_FONT_PT = 10;
/** Session / day columns never narrower than this (pt); width is shared equally. */
const MIN_SESSION_COL_W_PT = 6;
/** Floor for name column width when many session columns need space (pt). */
const ABS_MIN_NAME_COL_W_PT = 36;
const CLASS_TITLE_FONT_PT = 18;
const MONTH_BOX_W_PT = 118;
const MONTH_BOX_H_PT = 16;
const TITLE_ROW_GAP_AFTER_PT = 10;
const NAME_COL_HPADDING_PT = 8;

const { widthPt, heightPt } = PDF_PAGE_SPEC;

type PdfDoc = InstanceType<typeof PDFDocument>;

export type RegisterPdfStudentRow = {
  firstName: string;
  lastName: string;
};

export type RegisterPdfContext = {
  letterhead: ReportPdfLetterhead;
  letterheadLogo: Buffer | null;
  className: string;
  students: RegisterPdfStudentRow[];
  sessionColumnCount: number;
  /** Class meeting days in Mon→Sun order; each session column cycles this list across five weeks. */
  activeWeekdays: WeekdayKey[];
  uiLang: string;
};

function chunkPages<T>(arr: T[], pageSize: number): T[][] {
  if (arr.length === 0) return [[]];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += pageSize) {
    out.push(arr.slice(i, i + pageSize));
  }
  return out;
}

function registerSessionAbbr(lang: UiLang, day: WeekdayKey): string {
  return translate(lang, `pdf.registerAbbr.${day}`);
}

type RegisterColumnLayout = {
  firstColW: number;
  lastColW: number;
  sessionW: number;
  sessionTotalW: number;
};

/**
 * Size first/last columns to longest name at 12pt (one line); day columns share remaining width.
 * If ideals would leave sessions below MIN_SESSION_COL_W_PT, shrink name columns proportionally.
 */
function computeRegisterColumnLayout(
  doc: PdfDoc,
  students: RegisterPdfStudentRow[],
  lang: UiLang,
  usableW: number,
  sessionColumnCount: number,
): RegisterColumnLayout {
  doc.font("Helvetica").fontSize(NAME_FONT_PT).fillColor("#0f172a");
  let maxFirst = 0;
  let maxLast = 0;
  for (const s of students) {
    const fn = (s.firstName ?? "").trim() || "—";
    const ln = (s.lastName ?? "").trim() || "—";
    maxFirst = Math.max(maxFirst, doc.widthOfString(fn));
    maxLast = Math.max(maxLast, doc.widthOfString(ln));
  }
  doc.font("Helvetica-Bold").fontSize(9);
  maxFirst = Math.max(maxFirst, doc.widthOfString(translate(lang, "class.firstName")));
  maxLast = Math.max(maxLast, doc.widthOfString(translate(lang, "class.lastName")));

  const pad = NAME_COL_HPADDING_PT;
  const firstIdeal = Math.ceil(maxFirst) + pad;
  const lastIdeal = Math.ceil(maxLast) + pad;

  const rawSessionNeed = sessionColumnCount * MIN_SESSION_COL_W_PT;
  const sessionNeedMin = Math.min(rawSessionNeed, Math.max(0, usableW - ABS_MIN_NAME_COL_W_PT * 2));
  const maxNameBudget = Math.max(0, usableW - sessionNeedMin);
  const sumIdeal = firstIdeal + lastIdeal;

  let firstColW = firstIdeal;
  let lastColW = lastIdeal;
  if (sumIdeal > maxNameBudget && maxNameBudget > 0 && sumIdeal > 0) {
    firstColW = Math.floor((maxNameBudget * firstIdeal) / sumIdeal);
    lastColW = Math.floor((maxNameBudget * lastIdeal) / sumIdeal);
    let rem = maxNameBudget - firstColW - lastColW;
    if (rem > 0) {
      if (firstIdeal >= lastIdeal) firstColW += rem;
      else lastColW += rem;
    }
    firstColW = Math.max(ABS_MIN_NAME_COL_W_PT, firstColW);
    lastColW = Math.max(ABS_MIN_NAME_COL_W_PT, lastColW);
  }

  let sessionTotalW = usableW - firstColW - lastColW;
  while (
    sessionColumnCount > 0 &&
    sessionTotalW < sessionNeedMin &&
    firstColW + lastColW > ABS_MIN_NAME_COL_W_PT * 2
  ) {
    if (firstColW >= lastColW) firstColW -= 1;
    else lastColW -= 1;
    firstColW = Math.max(ABS_MIN_NAME_COL_W_PT, firstColW);
    lastColW = Math.max(ABS_MIN_NAME_COL_W_PT, lastColW);
    sessionTotalW = usableW - firstColW - lastColW;
  }

  const sessionW = sessionColumnCount > 0 ? sessionTotalW / sessionColumnCount : sessionTotalW;
  return { firstColW, lastColW, sessionW, sessionTotalW };
}

function drawRegisterPage(
  doc: PdfDoc,
  opts: {
    letterhead: ReportPdfLetterhead;
    letterheadLogo: Buffer | null;
    className: string;
    studentsPage: RegisterPdfStudentRow[];
    sessionColumnCount: number;
    activeWeekdays: WeekdayKey[];
    lang: UiLang;
    layout: RegisterColumnLayout;
  },
): void {
  const M = REGISTER_MARGIN_PT;
  doc.x = M;
  doc.y = M;

  drawReportLetterhead(doc, opts.letterhead, opts.letterheadLogo, { pageMarginPt: M });

  const titleRowTop = doc.y + 12;
  const fullTitleRowW = widthPt - M * 2;
  const monthLabel = translate(opts.lang, "pdf.registerMonth");
  doc.font("Helvetica").fontSize(9).fillColor("#64748b");
  const monthLabelW = doc.widthOfString(monthLabel);
  const monthBlockW = 8 + monthLabelW + 6 + MONTH_BOX_W_PT;
  const classNameWidth = Math.max(80, fullTitleRowW - monthBlockW);

  doc.font("Helvetica-Bold").fontSize(CLASS_TITLE_FONT_PT).fillColor("#0f172a");
  const classTitle = opts.className.trim() || "—";
  const titleRowH = Math.max(22, MONTH_BOX_H_PT + 8);
  doc.text(classTitle, M, titleRowTop, {
    width: classNameWidth,
    align: "left",
    lineGap: 0,
    height: titleRowH,
    ellipsis: true,
  });

  const boxX = widthPt - M - MONTH_BOX_W_PT;
  const boxY = titleRowTop + 4;
  doc.font("Helvetica").fontSize(9).fillColor("#64748b");
  doc.text(monthLabel, boxX - monthLabelW - 6, titleRowTop + 5, {
    width: monthLabelW + 2,
    align: "right",
  });
  doc.strokeColor("#94a3b8").lineWidth(0.65).rect(boxX, boxY, MONTH_BOX_W_PT, MONTH_BOX_H_PT).stroke();

  let y = titleRowTop + titleRowH + TITLE_ROW_GAP_AFTER_PT;
  doc.y = y;
  doc.x = M;

  const bottomY = heightPt - M;
  const sessionCount = opts.sessionColumnCount;
  const { firstColW, lastColW, sessionW, sessionTotalW } = opts.layout;

  const headerH = 22;
  const rowH = Math.max(13, Math.min(36, (bottomY - y - headerH) / ROWS_PER_PAGE));

  const x0 = M;
  const x1 = x0 + firstColW;
  const x2 = x1 + lastColW;
  const x3 = x2 + sessionTotalW;

  const hdrNumSize = Math.max(4, Math.min(8, sessionW * 0.85));
  const tableTop = y;
  const tableBottom = tableTop + headerH + ROWS_PER_PAGE * rowH;

  doc.font("Helvetica-Bold").fontSize(9).fillColor("#334155");
  doc.text(translate(opts.lang, "class.firstName"), x0 + 4, tableTop + 5, {
    width: firstColW - 8,
    align: "left",
  });
  doc.text(translate(opts.lang, "class.lastName"), x1 + 4, tableTop + 5, {
    width: lastColW - 8,
    align: "left",
  });

  const cycle = opts.activeWeekdays;
  doc.font("Helvetica").fontSize(hdrNumSize).fillColor("#475569");
  for (let c = 0; c < sessionCount; c++) {
    const cx = x2 + c * sessionW;
    const dayKey = cycle[c % cycle.length]!;
    const label = registerSessionAbbr(opts.lang, dayKey);
    doc.text(label, cx, tableTop + 6, { width: sessionW, align: "center" });
  }

  // Regular body size — reset so class title / header styles cannot leak (e.g. bold or larger size).
  doc.font("Helvetica");
  doc.fontSize(NAME_FONT_PT);
  doc.fillColor("#0f172a");
  for (let r = 0; r < ROWS_PER_PAGE; r++) {
    const st = opts.studentsPage[r];
    const rowY = tableTop + headerH + r * rowH;
    if (st) {
      const first = (st.firstName ?? "").trim() || "—";
      const last = (st.lastName ?? "").trim() || "—";
      const innerPad = 4;
      const textWFirst = firstColW - innerPad * 2;
      const textWLast = lastColW - innerPad * 2;
      const lineH = Math.min(rowH - 4, NAME_FONT_PT * 1.15);
      const textY = rowY + Math.max(2, (rowH - lineH) / 2);
      doc.text(first, x0 + innerPad, textY, {
        width: textWFirst,
        align: "left",
        lineGap: 0,
        height: lineH,
        ellipsis: true,
      });
      doc.text(last, x1 + innerPad, textY, {
        width: textWLast,
        align: "left",
        lineGap: 0,
        height: lineH,
        ellipsis: true,
      });
    }
  }

  doc.strokeColor("#94a3b8").lineWidth(0.35);
  const horizY: number[] = [tableTop, tableTop + headerH];
  for (let j = 1; j <= ROWS_PER_PAGE; j++) {
    horizY.push(tableTop + headerH + j * rowH);
  }
  for (const yy of horizY) {
    doc.moveTo(x0, yy).lineTo(x3, yy).stroke();
  }

  const vertXs = [x0, x1, x2, x3];
  for (let c = 1; c < sessionCount; c++) {
    vertXs.push(x2 + c * sessionW);
  }
  for (const vx of vertXs) {
    doc.moveTo(vx, tableTop).lineTo(vx, tableBottom).stroke();
  }
}

export function buildRegisterPdfBuffer(ctx: RegisterPdfContext): Promise<Buffer> {
  const lang: UiLang = isUiLang(ctx.uiLang) ? ctx.uiLang : "en";
  if (!ctx.activeWeekdays.length) {
    return Promise.reject(new Error("Register PDF requires at least one active weekday."));
  }
  const pages = chunkPages(ctx.students, ROWS_PER_PAGE);
  const usableW = widthPt - REGISTER_MARGIN_PT * 2;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: REGISTER_MARGIN_PT,
      info: {
        Title: `${ctx.className.trim() || "Class"} — Register`,
        Author: ctx.letterhead.displayName,
        Subject: "Attendance register",
      },
    });

    const buffers: Buffer[] = [];
    doc.on("data", (c: Buffer) => buffers.push(c));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const layout = computeRegisterColumnLayout(doc, ctx.students, lang, usableW, ctx.sessionColumnCount);

    for (let i = 0; i < pages.length; i++) {
      if (i > 0) doc.addPage();
      drawRegisterPage(doc, {
        letterhead: ctx.letterhead,
        letterheadLogo: ctx.letterheadLogo,
        className: ctx.className,
        studentsPage: pages[i] ?? [],
        sessionColumnCount: ctx.sessionColumnCount,
        activeWeekdays: ctx.activeWeekdays,
        lang,
        layout,
      });
    }

    doc.end();
  });
}
