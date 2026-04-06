import { effectiveActiveWeekdaysForRegister, registerSessionColumnCount } from "@/lib/activeWeekdays";
import type { ClassRow } from "@/lib/data/classesDb";
import { getTenantName } from "@/lib/data/memberships";
import { listStudents } from "@/lib/data/students";
import { downloadTenantLetterheadLogo } from "@/lib/data/tenantLetterheadLogo";
import { getTenantPdfLetterhead } from "@/lib/data/tenantPdfLetterhead";
import { isUiLang } from "@/lib/i18n/uiStrings";
import { buildLetterheadFromTenantSettings, type ReportPdfLetterhead } from "@/lib/pdf/reportPdf";
import { buildRegisterPdfBuffer } from "@/lib/pdf/registerPdf";
import { mergePdfBuffers } from "@/lib/pdf/mergePdf";

/**
 * Build one PDF by merging register sheets for each class that has at least one pupil.
 */
export async function mergeRegisterPdfsForClassRows(
  tenantId: string,
  classes: ClassRow[],
  uiLangRaw: string,
): Promise<{ pdf: Buffer; tenantRecordName: string }> {
  const uiLang = isUiLang(uiLangRaw) ? uiLangRaw : "en";
  const tenantRecordName = (await getTenantName(tenantId)) || "School";
  const pdfLhRow = await getTenantPdfLetterhead(tenantId);
  const letterhead: ReportPdfLetterhead = buildLetterheadFromTenantSettings(tenantRecordName, pdfLhRow);
  const letterheadLogo = await downloadTenantLetterheadLogo(pdfLhRow.pdf_letterhead_logo_path);

  const pdfs: Buffer[] = [];
  for (const klass of classes) {
    const weekdaysForPdf = effectiveActiveWeekdaysForRegister(klass.active_weekdays);
    const sessionCount = registerSessionColumnCount(weekdaysForPdf);

    const students = await listStudents(tenantId, klass.id);
    if (students.length === 0) continue;

    const studentRows = students.map((s) => ({
      firstName: (s.first_name ?? "").trim() || (s.display_name ?? "").trim(),
      lastName: (s.last_name ?? "").trim(),
    }));

    try {
      const pdf = await buildRegisterPdfBuffer({
        letterhead,
        letterheadLogo,
        className: klass.name,
        students: studentRows,
        sessionColumnCount: sessionCount,
        activeWeekdays: weekdaysForPdf,
        uiLang,
      });
      pdfs.push(pdf);
    } catch {
      /* skip broken class */
    }
  }

  if (pdfs.length === 0) {
    throw new Error("NO_PRINTABLE_REGISTERS");
  }

  const merged = await mergePdfBuffers(pdfs);
  return { pdf: merged, tenantRecordName };
}
