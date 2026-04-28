import { NextResponse } from "next/server";
import { canAccessClass } from "@/lib/auth/classAccess";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import type { CefrLevel } from "@/lib/data/classesDb";
import { canDeleteClass } from "@/lib/auth/resourceDelete";
import { archiveScholasticYearAndResetReports } from "@/lib/data/classArchives";
import { deleteClassInTenant, enrichClassWithAssignedTeacherDisplay, getClassInTenant, updateClass } from "@/lib/data/classesDb";
import { syncReportsLanguagesAfterClassOutputDefaultChange } from "@/lib/data/reportsDb";
import { getRoleForTenant } from "@/lib/data/memberships";
import type { ReportLanguageCode } from "@/lib/i18n/reportLanguages";
import { isReportLanguageCode } from "@/lib/i18n/reportLanguages";
import { mergeTenantCustomSubjectNames } from "@/lib/data/tenantCustomSubjects";
import { normalizeDefaultSubjectForStorage } from "@/lib/subjects";
import { isWeekdayKey, normalizeActiveWeekdays } from "@/lib/activeWeekdays";
import type { ReportKind, ReportPeriod } from "@/lib/reportInputs";
import { getTimetableSettings, isTimetableConflictError, moveClassTimetableSlotsToRoom } from "@/lib/data/timetableDb";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function normalizeScholasticYear(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function conflictMessage(kind: "room" | "teacher"): string {
  if (kind === "room") return "That room is already used in this period. Change or remove the other entry first.";
  return "That teacher is already teaching in this period. Change or remove the other entry first.";
}

export async function GET(_req: Request, context: { params: Promise<{ tenantId: string; classId: string }> }) {
  const { tenantId, classId } = await context.params;
  if (!isUuid(tenantId) || !isUuid(classId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (!role) return NextResponse.json({ error: "No access." }, { status: 403 });
  try {
    const klass = await getClassInTenant(tenantId, classId);
    if (!klass) return NextResponse.json({ error: "Class not found." }, { status: 404 });
    if (!canAccessClass({ role, viewerEmail: gate.email, klass })) {
      return NextResponse.json({ error: "You do not have access to this class." }, { status: 403 });
    }
    const withNames = await enrichClassWithAssignedTeacherDisplay(tenantId, klass);
    return NextResponse.json({ class: withNames });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load class.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ tenantId: string; classId: string }> }) {
  const { tenantId, classId } = await context.params;
  if (!isUuid(tenantId) || !isUuid(classId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (!role) return NextResponse.json({ error: "No access." }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const isLead = role === "owner" || role === "department_head";

  if (!isLead) {
    if (
      body.name !== undefined ||
      body.scholastic_year !== undefined ||
      body.cefr_level !== undefined ||
      body.default_subject !== undefined ||
      body.default_output_language !== undefined ||
      body.default_new_report_kind !== undefined ||
      body.default_new_report_period !== undefined ||
      body.active_weekdays !== undefined ||
      body.preferred_room_index !== undefined
    ) {
      return NextResponse.json(
        {
          error:
            "Only owners and department heads can change class settings. Teachers can adjust output language on each report if needed.",
        },
        { status: 403 },
      );
    }
  }

  const patch: Parameters<typeof updateClass>[2] = {};
  if (typeof body.name === "string" && isLead) patch.name = body.name;
  if (isLead && (body.scholastic_year === null || typeof body.scholastic_year === "string")) {
    patch.scholastic_year = body.scholastic_year === null ? null : (body.scholastic_year as string).trim() || null;
  }
  if (
    isLead &&
    (body.cefr_level === null || typeof body.cefr_level === "string")
  ) {
    if (body.cefr_level === null || (typeof body.cefr_level === "string" && body.cefr_level.trim() === "")) {
      patch.cefr_level = null;
    } else if (typeof body.cefr_level === "string" && ["A1", "A2", "B1", "B2", "C1", "C2"].includes(body.cefr_level)) {
      patch.cefr_level = body.cefr_level as CefrLevel;
    } else {
      return NextResponse.json({ error: "Invalid cefr_level." }, { status: 400 });
    }
  }
  if (typeof body.default_subject === "string" && isLead) {
    const normalized = normalizeDefaultSubjectForStorage(body.default_subject);
    if (normalized) {
      try {
        await mergeTenantCustomSubjectNames(tenantId, [normalized]);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Could not update subject list.";
        return NextResponse.json({ error: msg }, { status: 500 });
      }
      patch.default_subject = normalized;
    } else {
      return NextResponse.json({ error: "Invalid default_subject." }, { status: 400 });
    }
  }
  if (typeof body.default_output_language === "string" && isReportLanguageCode(body.default_output_language) && isLead) {
    patch.default_output_language = body.default_output_language as ReportLanguageCode;
  }
  if (body.default_new_report_kind === "standard" || body.default_new_report_kind === "short_course") {
    patch.default_new_report_kind = body.default_new_report_kind as ReportKind;
  }
  if (body.default_new_report_period === "first" || body.default_new_report_period === "second" || body.default_new_report_period === "third") {
    patch.default_new_report_period = body.default_new_report_period as ReportPeriod;
  }
  if (body.assigned_teacher_email !== undefined) {
    if (role !== "owner" && role !== "department_head") {
      return NextResponse.json({ error: "Only owners and department heads can assign teachers to a class." }, { status: 403 });
    }
    if (body.assigned_teacher_email === null) patch.assigned_teacher_email = null;
    else if (typeof body.assigned_teacher_email === "string") {
      patch.assigned_teacher_email = body.assigned_teacher_email.trim().toLowerCase() || null;
    }
  }

  if (isLead && body.active_weekdays !== undefined) {
    if (!Array.isArray(body.active_weekdays)) {
      return NextResponse.json({ error: "active_weekdays must be an array of weekday keys." }, { status: 400 });
    }
    const keys = body.active_weekdays
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim().toLowerCase())
      .filter(isWeekdayKey);
    patch.active_weekdays = normalizeActiveWeekdays(keys);
  }

  let preferredRoomIndex: number | null | undefined;
  if (isLead && body.preferred_room_index !== undefined) {
    if (body.preferred_room_index === null || body.preferred_room_index === "") {
      preferredRoomIndex = null;
    } else if (typeof body.preferred_room_index === "number" && Number.isFinite(body.preferred_room_index)) {
      preferredRoomIndex = Math.floor(body.preferred_room_index);
    } else {
      return NextResponse.json({ error: "preferred_room_index must be a number or null." }, { status: 400 });
    }
  }

  if (Object.keys(patch).length === 0 && preferredRoomIndex === undefined) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  try {
    const existing = await getClassInTenant(tenantId, classId);
    if (!existing) return NextResponse.json({ error: "Class not found." }, { status: 404 });
    if (!canAccessClass({ role, viewerEmail: gate.email, klass: existing })) {
      return NextResponse.json({ error: "You do not have access to this class." }, { status: 403 });
    }

    if (
      isLead &&
      patch.scholastic_year !== undefined &&
      normalizeScholasticYear(patch.scholastic_year) !== normalizeScholasticYear(existing.scholastic_year)
    ) {
      const endingLabel = existing.scholastic_year?.trim() || "Year not specified";
      await archiveScholasticYearAndResetReports({
        tenantId,
        classId,
        className: existing.name,
        endingScholasticYearLabel: endingLabel,
      });
    }

    const klass = Object.keys(patch).length > 0 ? await updateClass(tenantId, classId, patch) : existing;

    if (isLead && patch.default_output_language !== undefined) {
      await syncReportsLanguagesAfterClassOutputDefaultChange(
        tenantId,
        classId,
        patch.default_output_language,
        existing.default_output_language,
      );
    }

    if (isLead && preferredRoomIndex !== undefined && preferredRoomIndex !== null) {
      const settings = await getTimetableSettings(tenantId);
      if (!settings) return NextResponse.json({ error: "School not found." }, { status: 404 });
      if (preferredRoomIndex < 0 || preferredRoomIndex >= settings.room_count) {
        return NextResponse.json({ error: "preferred_room_index is out of range for this school’s room count." }, { status: 400 });
      }
      try {
        await moveClassTimetableSlotsToRoom(tenantId, classId, preferredRoomIndex);
      } catch (roomErr: unknown) {
        const msg = roomErr instanceof Error ? roomErr.message : "";
        const c = isTimetableConflictError(msg);
        if (c) return NextResponse.json({ error: conflictMessage(c) }, { status: 409 });
        throw roomErr;
      }
    }

    const withNames = await enrichClassWithAssignedTeacherDisplay(tenantId, klass);
    return NextResponse.json({ class: withNames });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update class.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ tenantId: string; classId: string }> }) {
  const { tenantId, classId } = await context.params;
  if (!isUuid(tenantId) || !isUuid(classId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (!role) return NextResponse.json({ error: "No access." }, { status: 403 });
  if (!canDeleteClass(role)) {
    return NextResponse.json({ error: "Only owners and department heads can delete classes." }, { status: 403 });
  }

  try {
    const existing = await getClassInTenant(tenantId, classId);
    if (!existing) return NextResponse.json({ error: "Class not found." }, { status: 404 });
    if (!canAccessClass({ role, viewerEmail: gate.email, klass: existing })) {
      return NextResponse.json({ error: "You do not have access to this class." }, { status: 403 });
    }
    await deleteClassInTenant(tenantId, classId);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to delete class.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
