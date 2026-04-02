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

function clipPdfText(s: string, maxLen: number): string {
  const t = s.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, Math.max(0, maxLen - 1))}…`;
}

export function buildTimetablePdfBuffer(opts: TimetablePdfInput): Promise<Buffer> {
  const lang: UiLang = isUiLang(opts.uiLang) ? opts.uiLang : "en";
  const periodTotal = opts.periodsAm + opts.periodsPm;
  const lunchCols = 1;
  const gridCols = periodTotal + lunchCols;
  const dayColW = 72;
  const usableW = PAGE_W - MARGIN_PT * 2 - dayColW;
  const colW = usableW / Math.max(1, gridCols);
  const roomLineH = 13;
  const dayRowH = Math.max(28, opts.roomCount * roomLineH + 6);

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

    doc.font("Helvetica-Bold").fontSize(7).fillColor("#475569");
    let x = x0 + dayColW;
    for (let p = 0; p < opts.periodsAm; p += 1) {
      doc.text(translate(lang, "pdf.timetablePeriodAm", { n: p + 1 }), x + 2, y, { width: colW - 4, align: "center" });
      x += colW;
    }
    doc.text(translate(lang, "pdf.timetableLunch"), x + 2, y, { width: colW - 4, align: "center" });
    x += colW;
    for (let p = 0; p < opts.periodsPm; p += 1) {
      doc.text(translate(lang, "pdf.timetablePeriodPm", { n: p + 1 }), x + 2, y, { width: colW - 4, align: "center" });
      x += colW;
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
        const isLunch = gc === opts.periodsAm;
        doc.rect(cx, y, colW, dayRowH).strokeColor("#cbd5e1").lineWidth(0.45).stroke();
        if (!isLunch) {
          const p = gc < opts.periodsAm ? gc : gc - 1;
          const ry0 = y + 2;
          for (let r = 0; r < opts.roomCount; r += 1) {
            const lineY = ry0 + r * roomLineH;
            const slot = slotMap.get(`${d}-${p}-${r}`);
            if (slot) {
              doc.save();
              doc.fillColor(teacherHexColor(slot.teacher_email)).rect(cx + 0.5, lineY - 1, colW - 1, roomLineH - 0.5).fill();
              doc.restore();
            }
            doc.font("Helvetica").fontSize(6).fillColor("#0f172a");
            const roomBit = translate(lang, "pdf.timetableRoomN", { n: r + 1 });
            let line = roomBit;
            if (slot) {
              line = `${clipPdfText(slot.class_name, 22)} · ${clipPdfText(slot.teacher_display, 18)} · ${roomBit}`;
            }
            doc.text(line, cx + 3, lineY, { width: colW - 6 });
          }
        } else {
          doc.font("Helvetica").fontSize(7).fillColor("#94a3b8");
          doc.text("—", cx, y + dayRowH / 2 - 4, { width: colW, align: "center" });
        }
        cx += colW;
      }

      y += dayRowH;
    }

    doc.end();
  });
}
