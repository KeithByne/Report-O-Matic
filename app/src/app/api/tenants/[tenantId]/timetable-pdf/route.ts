import { NextResponse } from "next/server";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { listClasses } from "@/lib/data/classesDb";
import { downloadTenantLetterheadLogo } from "@/lib/data/tenantLetterheadLogo";
import { getTenantPdfLetterhead } from "@/lib/data/tenantPdfLetterhead";
import { getRoleForTenant, getTenantName, listMembersForTenant } from "@/lib/data/memberships";
import { getTimetableSettings, listTimetableSlots, listTimetableSlotsForClassIds } from "@/lib/data/timetableDb";
import { isUiLang } from "@/lib/i18n/uiStrings";
import { buildLetterheadFromTenantSettings } from "@/lib/pdf/reportPdf";
import { buildTimetablePdfBuffer, type TimetablePdfSlot } from "@/lib/pdf/timetablePdf";
import { visibleMonFriDayIndexesFromClasses } from "@/lib/timetable/visibleTimetableDays";

export const runtime = "nodejs";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function safeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "timetable";
}

function displayForEmail(
  members: Awaited<ReturnType<typeof listMembersForTenant>>,
  email: string,
): string {
  const e = email.trim().toLowerCase();
  const m = members.find((x) => x.user_email === e);
  if (!m) return email;
  const fn = (m.first_name ?? "").trim();
  const ln = (m.last_name ?? "").trim();
  const name = `${fn} ${ln}`.trim();
  return name || email;
}

export async function GET(req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });

  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;

  const role = await getRoleForTenant(gate.email, tenantId);
  if (!role) return NextResponse.json({ error: "No access." }, { status: 403 });

  const url = new URL(req.url);
  const langParam = (url.searchParams.get("lang") || "en").trim();
  const uiLang = isUiLang(langParam) ? langParam : "en";
  const inline = url.searchParams.get("inline") === "1";

  const settings = await getTimetableSettings(tenantId);
  if (!settings) return NextResponse.json({ error: "School not found." }, { status: 404 });

  const members = await listMembersForTenant(tenantId);
  const classRows =
    role === "teacher"
      ? await listClasses(tenantId, { viewerRole: "teacher", viewerEmail: gate.email })
      : await listClasses(tenantId);
  const assignedByClassId = new Map(classRows.map((c) => [c.id, c.assigned_teacher_email]));

  let slotsRaw = await listTimetableSlots(tenantId);
  const viewerNorm = gate.email.trim().toLowerCase();
  if (role === "teacher") {
    slotsRaw = slotsRaw.filter((s) => {
      const assigned = assignedByClassId.get(s.class_id)?.trim().toLowerCase() ?? "";
      const fallback = s.teacher_email.trim().toLowerCase();
      const teacherNorm = assigned || fallback;
      return teacherNorm === viewerNorm;
    });
  }

  const slots: TimetablePdfSlot[] = slotsRaw.map((s) => {
    const assigned = assignedByClassId.get(s.class_id)?.trim().toLowerCase() ?? "";
    const teacherEmail = assigned || s.teacher_email.trim().toLowerCase();
    return {
      day_of_week: s.day_of_week,
      period_index: s.period_index,
      room_index: s.room_index,
      class_name: (s.class_name ?? "").trim() || "—",
      teacher_display: displayForEmail(members, teacherEmail),
      teacher_email: teacherEmail,
    };
  });

  const tenantRecordName = (await getTenantName(tenantId)) || "School";
  const pdfLhRow = await getTenantPdfLetterhead(tenantId);
  const letterhead = buildLetterheadFromTenantSettings(tenantRecordName, pdfLhRow);
  const letterheadLogo = await downloadTenantLetterheadLogo(pdfLhRow.pdf_letterhead_logo_path);

  const titleKey = role === "teacher" ? "pdf.timetableMyTitle" : "pdf.timetableTitle";
  const visibleDayIndexes = visibleMonFriDayIndexesFromClasses(classRows);

  try {
    const pdf = await buildTimetablePdfBuffer({
      letterhead,
      letterheadLogo,
      titleKey,
      periodsAm: settings.periods_am,
      periodsPm: settings.periods_pm,
      roomCount: role === "teacher" ? 1 : settings.room_count,
      slots,
      uiLang,
      visibleDayIndexes,
      teacherSinglePage: role === "teacher",
    });
    const fname = `${safeFilename(tenantRecordName)}-${role === "teacher" ? "my-timetable" : "timetable"}.pdf`;
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
