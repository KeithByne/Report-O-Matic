import { NextResponse } from "next/server";
import { effectiveActiveWeekdaysForRegister, registerSessionColumnCount } from "@/lib/activeWeekdays";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { getRoleForTenant, getTenantName } from "@/lib/data/memberships";
import { listClasses } from "@/lib/data/classesDb";
import { listStudents } from "@/lib/data/students";
import { downloadTenantLetterheadLogo } from "@/lib/data/tenantLetterheadLogo";
import { getTenantPdfLetterhead } from "@/lib/data/tenantPdfLetterhead";
import { isUiLang } from "@/lib/i18n/uiStrings";
import { buildLetterheadFromTenantSettings } from "@/lib/pdf/reportPdf";
import { buildRegisterPdfBuffer } from "@/lib/pdf/registerPdf";
import { mergePdfBuffers } from "@/lib/pdf/mergePdf";

export const runtime = "nodejs";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function safeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "registers";
}

export async function GET(req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });

  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (role !== "teacher") {
    return NextResponse.json({ error: "Only teachers can download this combined register." }, { status: 403 });
  }

  const url = new URL(req.url);
  const langParam = (url.searchParams.get("lang") || "en").trim();
  const uiLang = isUiLang(langParam) ? langParam : "en";
  const inline = url.searchParams.get("inline") === "1";

  const classes = await listClasses(tenantId, { viewerRole: "teacher", viewerEmail: gate.email });
  if (classes.length === 0) {
    return NextResponse.json({ error: "No classes assigned to you." }, { status: 404 });
  }

  const tenantRecordName = (await getTenantName(tenantId)) || "School";
  const pdfLhRow = await getTenantPdfLetterhead(tenantId);
  const letterhead = buildLetterheadFromTenantSettings(tenantRecordName, pdfLhRow);
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
    return NextResponse.json(
      {
        error: "No printable registers — add at least one pupil to a class assigned to you.",
      },
      { status: 409 },
    );
  }

  const merged = await mergePdfBuffers(pdfs);
  const fname = `${safeFilename(tenantRecordName)}-all-registers.pdf`;
  return new NextResponse(new Uint8Array(merged), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${fname}"`,
    },
  });
}
