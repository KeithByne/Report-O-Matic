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

export function buildTimetablePdfBuffer(opts: TimetablePdfInput): Promise<Buffer> {
  const lang: UiLang = isUiLang(opts.uiLang) ? opts.uiLang : "en";
  const periodTotal = opts.periodsAm + opts.periodsPm;
  const lunchCols = 1;
  const gridCols = periodTotal + lunchCols;
  const dayColW = 72;
  const usableW = PAGE_W - MARGIN_PT * 2 - dayColW;
  const periodColW = (usableW - LUNCH_COL_W_PT) / Math.max(1, periodTotal);

  /** One room row: Rm line + class/teacher block (two logical lines). */
  const roomBlockH = 30;
  const dayRowH = Math.max(32, opts.roomCount * roomBlockH + 8);

  const slotMap = new Map<string, TimetablePdfSlot>();
  for (const s of opts.slots) {
    slotMap.set(`${s.day_of_week}-${s.period_index}-${s.room_index}`, s);
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 0, autoFirstPage: true });
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.x = MARGIN_PT;
    doc.y = MARGIN_PT;

    drawReportLetterhead(doc, opts.letterhead, opts.letterheadLogo, { pageMarginPt: MARGIN_PT, pageWidthPt: PAGE_W });

    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#0f172a");
    doc.text(translate(lang, opts.titleKey), MARGIN_PT, doc.y, {
      width: PAGE_W - MARGIN_PT * 2,
    });

    let y = doc.y + 10;
    const headerH = 22;
    const x0 = MARGIN_PT;

    doc.font("Helvetica-Bold").fontSize(7);
    let x = x0 + dayColW;
    for (let gc = 0; gc < gridCols; gc += 1) {
      const cw = colWidthPt(gc, opts.periodsAm, periodColW);
      const isLunch = gc === opts.periodsAm;
      if (isLunch) {
        doc.save();
        doc.fillColor(LUNCH_FILL).rect(x, y, cw, headerH).fill();
        doc.restore();
        doc.rect(x, y, cw, headerH).strokeColor(LUNCH_STROKE).lineWidth(0.5).stroke();
        doc.fillColor(LUNCH_HEADER_TEXT);
      } else {
        doc.rect(x, y, cw, headerH).strokeColor("#cbd5e1").lineWidth(0.45).stroke();
        doc.fillColor("#475569");
      }
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

    y += headerH;
    doc.font("Helvetica").fontSize(6.2).fillColor("#0f172a");

    for (let d = 0; d < 5; d += 1) {
      if (y + dayRowH > PAGE_H - MARGIN_PT) {
        doc.addPage({ size: "A4", layout: "landscape", margin: 0 });
        doc.x = MARGIN_PT;
        doc.y = MARGIN_PT;
        drawReportLetterhead(doc, opts.letterhead, opts.letterheadLogo, { pageMarginPt: MARGIN_PT, pageWidthPt: PAGE_W });
        y = doc.y + 16;
      }

      const dayLabel = translate(lang, `weekday.${DAY_KEYS[d]}`);
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#334155");
      doc.text(dayLabel, x0, y + dayRowH / 2 - 5, { width: dayColW - 4, align: "right" });

      let cx = x0 + dayColW;
      for (let gc = 0; gc < gridCols; gc += 1) {
        const cw = colWidthPt(gc, opts.periodsAm, periodColW);
        const isLunch = gc === opts.periodsAm;
        if (isLunch) {
          doc.save();
          doc.fillColor(LUNCH_FILL).rect(cx, y, cw, dayRowH).fill();
          doc.restore();
          doc.rect(cx, y, cw, dayRowH).strokeColor(LUNCH_STROKE).lineWidth(0.5).stroke();
          doc.font("Helvetica").fontSize(8).fillColor(LUNCH_BODY_TEXT);
          doc.text("—", cx, y + dayRowH / 2 - 4, { width: cw, align: "center" });
        } else {
          doc.rect(cx, y, cw, dayRowH).strokeColor("#cbd5e1").lineWidth(0.45).stroke();
          const p = gc < opts.periodsAm ? gc : gc - 1;
          const innerLeft = cx + 3;
          const innerW = cw - 6;
          for (let r = 0; r < opts.roomCount; r += 1) {
            const blockTop = y + 4 + r * roomBlockH;
            if (r > 0) {
              doc.save();
              doc.strokeColor("#e2e8f0").lineWidth(0.35).moveTo(cx + 1, blockTop).lineTo(cx + cw - 1, blockTop).stroke();
              doc.restore();
            }
            const slot = slotMap.get(`${d}-${p}-${r}`);
            if (slot) {
              doc.save();
              doc
                .fillColor(teacherHexColor(slot.teacher_email))
                .rect(cx + 0.5, blockTop - 0.5, cw - 1, roomBlockH - 1)
                .fill();
              doc.restore();
            }
            doc.font("Helvetica-Bold").fontSize(6).fillColor("#0f172a");
            doc.text(translate(lang, "pdf.timetableRoomN", { n: r + 1 }), innerLeft, blockTop + 1, {
              width: innerW,
            });
            if (slot) {
              const classLine = slot.class_name.trim() || "—";
              const teacherLine = slot.teacher_display.trim() || "—";
              doc.font("Helvetica").fontSize(5.5).fillColor("#0f172a");
              doc.text(classLine, innerLeft, blockTop + 9, {
                width: innerW,
                lineGap: 0.5,
                height: 9,
                ellipsis: true,
              });
              doc.text(teacherLine, innerLeft, blockTop + 20, {
                width: innerW,
                lineGap: 0.5,
                height: 9,
                ellipsis: true,
              });
            }
          }
        }
        cx += cw;
      }

      y += dayRowH;
    }

    doc.end();
  });
}
