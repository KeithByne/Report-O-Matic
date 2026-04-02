import PDFDocument from "pdfkit";
import type { WeekdayKey } from "@/lib/activeWeekdays";
import { isUiLang, translate, type UiLang } from "@/lib/i18n/uiStrings";
import { PDF_PAGE_SPEC } from "@/lib/pdf/reportPdfLayoutModel";
import { drawReportLetterhead, type ReportPdfLetterhead } from "@/lib/pdf/reportPdf";
import { teacherHexColor } from "@/lib/timetable/teacherColor";

type PdfDoc = InstanceType<typeof PDFDocument>;

const DAY_KEYS: WeekdayKey[] = ["mon", "tue", "wed", "thu", "fri"];

/** A4 landscape width/height (points). */
const PAGE_W = PDF_PAGE_SPEC.heightPt;
const PAGE_H = PDF_PAGE_SPEC.widthPt;
const MARGIN_PT = 32;

/** Lunch column width (pt)—kept narrow vs lesson periods. */
const LUNCH_COL_W_PT = 30;

const LUNCH_FILL = "#d1fae5";
const LUNCH_STROKE = "#6ee7b7";
const LUNCH_HEADER_TEXT = "#14532d";
const LUNCH_BODY_TEXT = "#166534";

const PERIOD_HEADER_H = 22;

export type TimetablePdfSlot = {
  day_of_week: number;
  period_index: number;
  room_index: number;
  class_name: string;
  teacher_display: string;
  teacher_email: string;
};

export type TimetablePdfInput = {
  letterhead: ReportPdfLetterhead;
  letterheadLogo: Buffer | null;
  titleKey: "pdf.timetableTitle" | "pdf.timetableMyTitle";
  periodsAm: number;
  periodsPm: number;
  roomCount: number;
  slots: TimetablePdfSlot[];
  uiLang: string;
};

function colWidthPt(gc: number, periodsAm: number, periodColW: number): number {
  return gc === periodsAm ? LUNCH_COL_W_PT : periodColW;
}

function drawPeriodHeaderRow(
  doc: PdfDoc,
  lang: UiLang,
  y: number,
  x0: number,
  dayColW: number,
  gridCols: number,
  opts: { periodsAm: number; periodsPm: number },
  periodColW: number,
): number {
  doc.font("Helvetica-Bold").fontSize(7);
  let x = x0 + dayColW;
  for (let gc = 0; gc < gridCols; gc += 1) {
    const cw = colWidthPt(gc, opts.periodsAm, periodColW);
    const isLunch = gc === opts.periodsAm;
    doc.save();
    doc.fillColor(LUNCH_FILL).rect(x, y, cw, PERIOD_HEADER_H).fill();
    doc.restore();
    doc.rect(x, y, cw, PERIOD_HEADER_H).strokeColor(LUNCH_STROKE).lineWidth(0.5).stroke();
    doc.fillColor(LUNCH_HEADER_TEXT);
    const label =
      isLunch
        ? translate(lang, "pdf.timetableLunch")
        : gc < opts.periodsAm
          ? translate(lang, "pdf.timetablePeriodAm", { n: gc + 1 })
          : translate(lang, "pdf.timetablePeriodPm", { n: gc - opts.periodsAm });
    doc.text(label, x + 2, y + (isLunch ? 6 : 4), {
      width: cw - 4,
      align: "center",
      lineBreak: true,
    });
    x += cw;
  }
  return y + PERIOD_HEADER_H;
}

export function buildTimetablePdfBuffer(opts: TimetablePdfInput): Promise<Buffer> {
  const lang: UiLang = isUiLang(opts.uiLang) ? opts.uiLang : "en";
  const periodTotal = opts.periodsAm + opts.periodsPm;
  const lunchCols = 1;
  const gridCols = periodTotal + lunchCols;
  const dayColW = 72;
  const usableW = PAGE_W - MARGIN_PT * 2 - dayColW;
  const periodColW = (usableW - LUNCH_COL_W_PT) / Math.max(1, periodTotal);

  const slotMap = new Map<string, TimetablePdfSlot>();
  for (const s of opts.slots) {
    slotMap.set(`${s.day_of_week}-${s.period_index}-${s.room_index}`, s);
  }

  const roomPages = Math.max(1, opts.roomCount);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 0, autoFirstPage: true });
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const x0 = MARGIN_PT;

    for (let roomIndex = 0; roomIndex < roomPages; roomIndex += 1) {
      if (roomIndex > 0) {
        doc.addPage({ size: "A4", layout: "landscape", margin: 0 });
      }

      doc.x = MARGIN_PT;
      doc.y = MARGIN_PT;
      drawReportLetterhead(doc, opts.letterhead, opts.letterheadLogo, { pageMarginPt: MARGIN_PT, pageWidthPt: PAGE_W });

      doc.moveDown(0.6);
      doc.font("Helvetica-Bold").fontSize(14).fillColor("#0f172a");
      doc.text(translate(lang, opts.titleKey), MARGIN_PT, doc.y, {
        width: PAGE_W - MARGIN_PT * 2,
      });
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#334155");
      doc.text(translate(lang, "pdf.timetablePageRoom", { n: roomIndex + 1 }), MARGIN_PT, doc.y + 4, {
        width: PAGE_W - MARGIN_PT * 2,
      });

      let y = doc.y + 14;
      y = drawPeriodHeaderRow(doc, lang, y, x0, dayColW, gridCols, opts, periodColW);

      const yBodyStart = y + 4;
      const availableForRows = PAGE_H - MARGIN_PT - yBodyStart - 6;
      const dayRowH = Math.max(76, Math.floor(availableForRows / 5));

      doc.font("Helvetica").fontSize(6.2).fillColor("#0f172a");

      for (let d = 0; d < 5; d += 1) {
        const rowY = yBodyStart + d * dayRowH;
        const dayLabel = translate(lang, `weekday.${DAY_KEYS[d]}`);
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#334155");
        doc.text(dayLabel, x0, rowY + dayRowH / 2 - 5, { width: dayColW - 4, align: "right" });

        let cx = x0 + dayColW;
        for (let gc = 0; gc < gridCols; gc += 1) {
          const cw = colWidthPt(gc, opts.periodsAm, periodColW);
          const isLunch = gc === opts.periodsAm;
          if (isLunch) {
            doc.save();
            doc.fillColor(LUNCH_FILL).rect(cx, rowY, cw, dayRowH).fill();
            doc.restore();
            doc.rect(cx, rowY, cw, dayRowH).strokeColor(LUNCH_STROKE).lineWidth(0.5).stroke();
            doc.font("Helvetica").fontSize(8).fillColor(LUNCH_BODY_TEXT);
            doc.text("—", cx, rowY + dayRowH / 2 - 4, { width: cw, align: "center" });
          } else {
            doc.rect(cx, rowY, cw, dayRowH).strokeColor("#cbd5e1").lineWidth(0.45).stroke();
            const p = gc < opts.periodsAm ? gc : gc - 1;
            const innerLeft = cx + 4;
            const innerW = cw - 8;
            const blockTop = rowY + 6;
            const blockH = dayRowH - 12;
            const slot = slotMap.get(`${d}-${p}-${roomIndex}`);
            if (slot) {
              doc.save();
              doc
                .fillColor(teacherHexColor(slot.teacher_email))
                .rect(cx + 0.5, blockTop - 1, cw - 1, blockH + 2)
                .fill();
              doc.restore();
            }
            doc.font("Helvetica-Bold").fontSize(7).fillColor("#0f172a");
            doc.text(translate(lang, "pdf.timetableRoomN", { n: roomIndex + 1 }), innerLeft, blockTop, {
              width: innerW,
            });
            if (slot) {
              const classLine = slot.class_name.trim() || "—";
              const teacherLine = slot.teacher_display.trim() || "—";
              const classBlockH = Math.max(24, blockH * 0.52);
              const teacherBlockH = Math.max(18, blockH - classBlockH - 14);
              doc.font("Helvetica").fontSize(6.5).fillColor("#0f172a");
              doc.text(classLine, innerLeft, blockTop + 12, {
                width: innerW,
                lineGap: 1,
                height: classBlockH,
                ellipsis: true,
              });
              doc.font("Helvetica").fontSize(6).fillColor("#0f172a");
              doc.text(teacherLine, innerLeft, blockTop + 12 + classBlockH + 2, {
                width: innerW,
                lineGap: 0.5,
                height: teacherBlockH,
                ellipsis: true,
              });
            }
          }
          cx += cw;
        }
      }
    }

    doc.end();
  });
}
