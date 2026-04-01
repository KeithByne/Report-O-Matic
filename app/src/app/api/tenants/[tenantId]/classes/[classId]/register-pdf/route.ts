import { NextResponse } from "next/server";
import { registerSessionColumnCount } from "@/lib/activeWeekdays";
import { canAccessClass } from "@/lib/auth/classAccess";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { getClassInTenant } from "@/lib/data/classesDb";
import { getRoleForTenant, getTenantName } from "@/lib/data/memberships";
import { listStudents } from "@/lib/data/students";
import { downloadTenantLetterheadLogo } from "@/lib/data/tenantLetterheadLogo";
import { getTenantPdfLetterhead } from "@/lib/data/tenantPdfLetterhead";
import { isUiLang } from "@/lib/i18n/uiStrings";
import { buildLetterheadFromTenantSettings } from "@/lib/pdf/reportPdf";
import { buildRegisterPdfBuffer } from "@/lib/pdf/registerPdf";

export const runtime = "nodejs";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function safeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "register";
}

export async function GET(req: Request, context: { params: Promise<{ tenantId: string; classId: string }> }) {
  const { tenantId, classId } = await context.params;
  if (!isUuid(tenantId) || !isUuid(classId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (!role) return NextResponse.json({ error: "No access." }, { status: 403 });

  const klass = await getClassInTenant(tenantId, classId);
  if (!klass) return NextResponse.json({ error: "Class not found." }, { status: 404 });
  if (!canAccessClass({ role, viewerEmail: gate.email, klass })) {
    return NextResponse.json({ error: "You do not have access to this class." }, { status: 403 });
  }

  const sessionCount = registerSessionColumnCount(klass.active_weekdays);
  if (sessionCount === 0) {
    return NextResponse.json(
      { error: "Choose at least one weekday the class meets (class settings) before printing the register." },
      { status: 409 },
    );
  }

  const students = await listStudents(tenantId, classId);
  if (students.length === 0) {
    return NextResponse.json({ error: "No pupils in this class." }, { status: 404 });
  }

  const url = new URL(req.url);
  const langParam = (url.searchParams.get("lang") || "en").trim();
  const uiLang = isUiLang(langParam) ? langParam : "en";
  const inline = url.searchParams.get("inline") === "1";

  const tenantRecordName = (await getTenantName(tenantId)) || "School";
  const pdfLhRow = await getTenantPdfLetterhead(tenantId);
  const letterhead = buildLetterheadFromTenantSettings(tenantRecordName, pdfLhRow);
  const letterheadLogo = await downloadTenantLetterheadLogo(pdfLhRow.pdf_letterhead_logo_path);

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
      activeWeekdays: klass.active_weekdays,
      uiLang,
    });
    const fname = `${safeFilename(klass.name || "class")}-register.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${fname}"`,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to build PDF.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
