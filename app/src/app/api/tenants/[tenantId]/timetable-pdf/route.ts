import { NextResponse } from "next/server";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { listClasses } from "@/lib/data/classesDb";
import { downloadTenantLetterheadLogoForPdf } from "@/lib/data/tenantLetterheadLogo";
import { getTenantPdfLetterhead } from "@/lib/data/tenantPdfLetterhead";
import { getRoleForTenant, getTenantName, listMembersForTenant } from "@/lib/data/memberships";
import { getTimetableSettings, listTimetableSlots, type TimetableSettings } from "@/lib/data/timetableDb";
import { schoolWeekdaysToSortedDayIndexes } from "@/lib/timetable/timetableSchoolWeekdays";
import { isUiLang, translate, type UiLang } from "@/lib/i18n/uiStrings";
import { buildLetterheadFromTenantSettings } from "@/lib/pdf/reportPdf";
import { pdfExportResponse } from "@/lib/credits/exportPdf";
import { buildTimetablePdfBuffer, type TimetablePdfSlot } from "@/lib/pdf/timetablePdf";
import { mergePdfBuffers } from "@/lib/pdf/mergePdf";
import { getServiceSupabase } from "@/lib/supabase/service";

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

function visibleDayIndexesForPdf(settings: TimetableSettings): number[] {
  const days = schoolWeekdaysToSortedDayIndexes(settings.school_weekdays);
  return days.length > 0 ? days : [0, 1, 2, 3, 4];
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
  const uiLang: UiLang = isUiLang(langParam) ? langParam : "en";
  const inline = url.searchParams.get("inline") === "1";
  const modeParam = (url.searchParams.get("mode") || "").trim().toLowerCase();
  const ownerMode = modeParam === "by_teacher" || modeParam === "by_room" || modeParam === "overview" ? modeParam : "overview";
  const roomFilterRaw = (url.searchParams.get("room_index") || "").trim();

  const settings = await getTimetableSettings(tenantId);
  if (!settings) return NextResponse.json({ error: "School not found." }, { status: 404 });

  const members = await listMembersForTenant(tenantId);
  const classRows =
    role === "teacher"
      ? await listClasses(tenantId, { viewerRole: "teacher", viewerEmail: gate.email })
      : await listClasses(tenantId);
  const assignedByClassId = new Map(classRows.map((c) => [c.id, c.assigned_teacher_email]));
  const classSizeById = new Map<string, number>();
  if (classRows.length > 0) {
    const supabase = getServiceSupabase();
    if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });
    const classIds = classRows.map((c) => c.id);
    const { data: studentRows, error: sErr } = await supabase
      .from("students")
      .select("class_id")
      .eq("tenant_id", tenantId)
      .in("class_id", classIds);
    if (sErr) return NextResponse.json({ error: sErr.message || "Could not count students." }, { status: 500 });
    for (const r of (studentRows ?? []) as { class_id: string }[]) {
      classSizeById.set(r.class_id, (classSizeById.get(r.class_id) ?? 0) + 1);
    }
  }

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
      class_size: classSizeById.get(s.class_id) ?? 0,
      teacher_display: displayForEmail(members, teacherEmail),
      teacher_email: teacherEmail,
    };
  });

  const tenantRecordName = (await getTenantName(tenantId)) || "School";
  const pdfLhRow = await getTenantPdfLetterhead(tenantId);
  const letterhead = buildLetterheadFromTenantSettings(tenantRecordName, pdfLhRow, uiLang);
  const letterheadLogo = await downloadTenantLetterheadLogoForPdf(pdfLhRow.pdf_letterhead_logo_path);

  const titleKey = role === "teacher" ? "pdf.timetableMyTitle" : "pdf.timetableTitle";
  const visibleDayIndexes = visibleDayIndexesForPdf(settings);

  try {
    const printMode = role === "teacher" ? "by_teacher" : ownerMode;
    let pdf: Buffer;
    if (printMode === "by_teacher") {
      if (role === "teacher") {
        pdf = await buildTimetablePdfBuffer({
          letterhead,
          letterheadLogo,
          titleKey: "pdf.timetableMyTitle",
          periodsAm: settings.periods_am,
          periodsPm: settings.periods_pm,
          roomCount: 1,
          slots,
          uiLang,
          visibleDayIndexes,
          teacherSinglePage: true,
        });
      } else {
        const teacherEmails = [...new Set(slots.map((s) => s.teacher_email).filter(Boolean))].sort((a, b) =>
          a.localeCompare(b),
        );
        // School admins always get one merged PDF (one A4 page per teacher). Ignore any legacy teacher_email query param.
        const targetTeacherEmails = teacherEmails;
        if (targetTeacherEmails.length === 0) {
          return NextResponse.json({ error: "No timetable entries for any teacher yet." }, { status: 409 });
        }
        const perTeacher = await Promise.all(
          targetTeacherEmails.map((te) =>
            (() => {
              const teacherSlots = slots.filter((s) => s.teacher_email === te);
              const headline = displayForEmail(members, te);
              return buildTimetablePdfBuffer({
                letterhead,
                letterheadLogo,
                titleKey: "pdf.timetableMyTitle",
                periodsAm: settings.periods_am,
                periodsPm: settings.periods_pm,
                roomCount: 1,
                slots: teacherSlots,
                uiLang,
                visibleDayIndexes: visibleDayIndexesForPdf(settings),
                teacherSinglePage: true,
                getPageHeadline: () => headline,
              });
            })(),
          ),
        );
        pdf = await mergePdfBuffers(perTeacher);
      }
    } else if (printMode === "by_room") {
      const activeRoomIndices = [...new Set(slots.map((s) => s.room_index).filter((n) => Number.isFinite(n) && n >= 0))].sort((a, b) => a - b);
      const roomFilter = roomFilterRaw === "" ? null : Math.max(0, Math.floor(Number(roomFilterRaw)));
      const targetRoomIndices =
        roomFilter === null || !Number.isFinite(roomFilter)
          ? activeRoomIndices
          : activeRoomIndices.filter((n) => n === roomFilter);
      if (roomFilter !== null && (!Number.isFinite(roomFilter) || roomFilter < 0)) {
        return NextResponse.json({ error: "room_index must be a non-negative number." }, { status: 400 });
      }
      if (activeRoomIndices.length === 0) {
        return NextResponse.json(
          { error: "No timetable entries to print by room yet." },
          { status: 409 },
        );
      }
      if (targetRoomIndices.length === 0) {
        return NextResponse.json({ error: "No timetable entries for that room." }, { status: 409 });
      }
      pdf = await buildTimetablePdfBuffer({
        letterhead,
        letterheadLogo,
        titleKey: "pdf.timetableTitle",
        periodsAm: settings.periods_am,
        periodsPm: settings.periods_pm,
        roomCount: settings.room_count,
        slots,
        uiLang,
        visibleDayIndexes: visibleDayIndexesForPdf(settings),
        teacherSinglePage: false,
        roomsPerPage: 1,
        includedRoomIndices: targetRoomIndices,
        getPageHeadline: ({ roomIndices }) =>
          translate(uiLang, "pdf.timetablePageRoom", { n: roomIndices[0]! + 1 }),
        suppressRoomRangeSubtitle: true,
      });
    } else {
      pdf = await buildTimetablePdfBuffer({
        letterhead,
        letterheadLogo,
        titleKey: "pdf.timetableTitle",
        periodsAm: settings.periods_am,
        periodsPm: settings.periods_pm,
        roomCount: settings.room_count,
        slots,
        uiLang,
        visibleDayIndexes,
        teacherSinglePage: false,
        roomsPerPage: 5,
        getPageHeadline: () => translate(uiLang, "timetable.printModeOverview"),
      });
    }
    const fname = `${safeFilename(tenantRecordName)}-${role === "teacher" ? "my-timetable" : "timetable"}.pdf`;
    return pdfExportResponse(tenantId, pdf, { inline, filename: fname });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to build PDF.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
