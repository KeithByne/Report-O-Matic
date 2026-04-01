import PDFDocument from "pdfkit";
import { isUiLang, translate, type UiLang } from "@/lib/i18n/uiStrings";
import { PDF_PAGE_SPEC } from "@/lib/pdf/reportPdfLayoutModel";
import { drawReportLetterhead, type ReportPdfLetterhead } from "@/lib/pdf/reportPdf";

const REGISTER_MARGIN_PT = 28;
const ROWS_PER_PAGE = 16;
/** Body: first / last name columns (PDF points, 1 pt = 1/72 in). */
const NAME_FONT_PT = 14;
const CLASS_TITLE_FONT_PT = 18;

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

function clipName(s: string, maxLen: number): string {
  const t = s.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, Math.max(0, maxLen - 1))}…`;
}

function drawRegisterPage(
  doc: PdfDoc,
  opts: {
    letterhead: ReportPdfLetterhead;
    letterheadLogo: Buffer | null;
    className: string;
    studentsPage: RegisterPdfStudentRow[];
    sessionColumnCount: number;
    lang: UiLang;
  },
): void {
  const M = REGISTER_MARGIN_PT;
  doc.x = M;
  doc.y = M;

  drawReportLetterhead(doc, opts.letterhead, opts.letterheadLogo, { pageMarginPt: M });

  let y = doc.y + 12;
  doc.font("Helvetica-Bold").fontSize(CLASS_TITLE_FONT_PT).fillColor("#0f172a");
  doc.text(opts.className.trim() || "—", M, y, {
    width: widthPt - M * 2,
    align: "left",
  });
  y = doc.y + 10;

  const usableW = widthPt - M * 2;
  const bottomY = heightPt - M;
  const sessionCount = opts.sessionColumnCount;

  let firstColW = Math.min(118, usableW * 0.24);
  let lastColW = Math.min(118, usableW * 0.24);
  let sessionTotalW = usableW - firstColW - lastColW;
  let sessionW = sessionCount > 0 ? sessionTotalW / sessionCount : sessionTotalW;

  if (sessionW < 4 && sessionCount > 0) {
    const need = sessionCount * 4;
    const deficit = need - sessionTotalW;
    const take = Math.min(deficit / 2, firstColW - 72);
    firstColW = Math.max(72, firstColW - Math.max(0, take));
    lastColW = Math.max(72, lastColW - Math.max(0, take));
    sessionTotalW = usableW - firstColW - lastColW;
    sessionW = sessionTotalW / sessionCount;
  }

  const headerH = 22;
  const rowH = Math.max(16, Math.min(36, (bottomY - y - headerH) / ROWS_PER_PAGE));

  const x0 = M;
  const x1 = x0 + firstColW;
  const x2 = x1 + lastColW;
  const x3 = x2 + sessionTotalW;

  const hdrNumSize = Math.max(5, Math.min(8, sessionW * 0.9));
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

  doc.font("Helvetica").fontSize(hdrNumSize).fillColor("#475569");
  for (let c = 0; c < sessionCount; c++) {
    const cx = x2 + c * sessionW;
    doc.text(String(c + 1), cx, tableTop + 6, { width: sessionW, align: "center" });
  }

  // Regular Helvetica 14pt only — reset so class title / header styles cannot leak (e.g. bold or larger size).
  doc.font("Helvetica");
  doc.fontSize(NAME_FONT_PT);
  doc.fillColor("#0f172a");
  for (let r = 0; r < ROWS_PER_PAGE; r++) {
    const st = opts.studentsPage[r];
    const rowY = tableTop + headerH + r * rowH;
    if (st) {
      const first = clipName(st.firstName, Math.max(8, Math.floor(firstColW / 7)));
      const last = clipName(st.lastName, Math.max(8, Math.floor(lastColW / 7)));
      const textY = rowY + Math.max(2, (rowH - NAME_FONT_PT) / 2);
      doc.text(first, x0 + 4, textY, {
        width: firstColW - 8,
        align: "left",
        lineGap: 0,
        height: rowH - 4,
        ellipsis: true,
      });
      doc.text(last, x1 + 4, textY, {
        width: lastColW - 8,
        align: "left",
        lineGap: 0,
        height: rowH - 4,
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
  const pages = chunkPages(ctx.students, ROWS_PER_PAGE);

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

    for (let i = 0; i < pages.length; i++) {
      if (i > 0) doc.addPage();
      drawRegisterPage(doc, {
        letterhead: ctx.letterhead,
        letterheadLogo: ctx.letterheadLogo,
        className: ctx.className,
        studentsPage: pages[i] ?? [],
        sessionColumnCount: ctx.sessionColumnCount,
        lang,
      });
    }

    doc.end();
  });
}
