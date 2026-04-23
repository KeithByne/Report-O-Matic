import { NextResponse } from "next/server";
import { canAccessClass } from "@/lib/auth/classAccess";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { isValidClassLevelForRubric } from "@/lib/classLevel";
import { canDeleteClass } from "@/lib/auth/resourceDelete";
import { archiveScholasticYearAndResetReports } from "@/lib/data/classArchives";
import { deleteClassInTenant, enrichClassWithAssignedTeacherDisplay, getClassInTenant, updateClass } from "@/lib/data/classesDb";
import { syncReportsLanguagesAfterClassOutputDefaultChange } from "@/lib/data/reportsDb";
import { getRoleForTenant } from "@/lib/data/memberships";
import type { ReportLanguageCode } from "@/lib/i18n/reportLanguages";
import { isReportLanguageCode } from "@/lib/i18n/reportLanguages";
import { mergeTenantCustomSubjectEntries } from "@/lib/data/tenantCustomSubjects";
import { parseGradeRubricProfile } from "@/lib/gradeRubricProfile";
import { resolveDefaultSubjectInputToStorage } from "@/lib/subjectFormResolve";
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
      body.preferred_room_index !== undefined ||
      body.preferred_lesson_period_index !== undefined ||
      body.grade_rubric_profile !== undefined
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

  const klassExisting = await getClassInTenant(tenantId, classId);
  if (!klassExisting) return NextResponse.json({ error: "Class not found." }, { status: 404 });
  if (!canAccessClass({ role, viewerEmail: gate.email, klass: klassExisting })) {
    return NextResponse.json({ error: "You do not have access to this class." }, { status: 403 });
  }

  const patch: Parameters<typeof updateClass>[2] = {};
  if (typeof body.name === "string" && isLead) patch.name = body.name;
  if (isLead && (body.scholastic_year === null || typeof body.scholastic_year === "string")) {
    patch.scholastic_year = body.scholastic_year === null ? null : (body.scholastic_year as string).trim() || null;
  }
  if (isLead && body.grade_rubric_profile !== undefined) {
    patch.grade_rubric_profile = parseGradeRubricProfile(body.grade_rubric_profile, klassExisting.grade_rubric_profile);
  }

  const rubricForClassLevel =
    isLead && body.grade_rubric_profile !== undefined
      ? parseGradeRubricProfile(body.grade_rubric_profile, klassExisting.grade_rubric_profile)
      : klassExisting.grade_rubric_profile;

  if (typeof body.default_subject === "string" && isLead) {
    let norm: string;
    try {
      norm = resolveDefaultSubjectInputToStorage(body.default_subject);
    } catch {
      return NextResponse.json({ error: "Invalid default_subject." }, { status: 400 });
    }
    patch.default_subject = norm;
    try {
      const rubricForMerge =
        body.default_subject_rubric_profile !== undefined
          ? parseGradeRubricProfile(body.default_subject_rubric_profile, klassExisting.grade_rubric_profile)
          : klassExisting.grade_rubric_profile;
      await mergeTenantCustomSubjectEntries(tenantId, [{ name: norm, rubric_profile: rubricForMerge }]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not update subject list.";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (isLead) {
    const shouldRevalidateLevel = patch.default_subject !== undefined || patch.grade_rubric_profile !== undefined;
    if (shouldRevalidateLevel && body.cefr_level === undefined && klassExisting.cefr_level) {
      if (!isValidClassLevelForRubric(klassExisting.cefr_level, rubricForClassLevel)) {
        patch.cefr_level = null;
      }
    }
    if (body.cefr_level === null || typeof body.cefr_level === "string") {
      if (body.cefr_level === null || (typeof body.cefr_level === "string" && body.cefr_level.trim() === "")) {
        patch.cefr_level = null;
      } else if (typeof body.cefr_level === "string") {
        const v = body.cefr_level.trim();
        if (!isValidClassLevelForRubric(v, rubricForClassLevel)) {
          return NextResponse.json(
            { error: "Class level is not valid for this subject type (CEFR vs year group)." },
            { status: 400 },
          );
        }
        patch.cefr_level = v;
      }
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

  if (isLead && body.preferred_lesson_period_index !== undefined) {
    if (body.preferred_lesson_period_index === null || body.preferred_lesson_period_index === "") {
      patch.preferred_lesson_period_index = null;
    } else if (typeof body.preferred_lesson_period_index === "number" && Number.isFinite(body.preferred_lesson_period_index)) {
      const n = Math.floor(body.preferred_lesson_period_index);
      const settings = await getTimetableSettings(tenantId);
      if (!settings) return NextResponse.json({ error: "School not found." }, { status: 404 });
      const max = settings.periods_am + settings.periods_pm;
      if (max < 1 || n < 0 || n >= max) {
        return NextResponse.json(
          { error: "preferred_lesson_period_index is out of range for this school’s AM/PM period counts." },
          { status: 400 },
        );
      }
      patch.preferred_lesson_period_index = n;
    } else {
      return NextResponse.json({ error: "preferred_lesson_period_index must be a number or null." }, { status: 400 });
    }
  }

  /** When set after validation, move existing timetable slots for this class to this room (no-op if there are no slots). */
  let timetableRoomMoveTarget: number | undefined;
  if (isLead && body.preferred_room_index !== undefined) {
    const settings = await getTimetableSettings(tenantId);
    if (!settings) return NextResponse.json({ error: "School not found." }, { status: 404 });
    if (body.preferred_room_index === null || body.preferred_room_index === "") {
      patch.preferred_room_index = null;
    } else if (typeof body.preferred_room_index === "number" && Number.isFinite(body.preferred_room_index)) {
      const n = Math.floor(body.preferred_room_index);
      if (n < 0 || n >= settings.room_count) {
        return NextResponse.json(
          { error: "preferred_room_index is out of range for this school’s room count." },
          { status: 400 },
        );
      }
      patch.preferred_room_index = n;
      timetableRoomMoveTarget = n;
    } else {
      return NextResponse.json({ error: "preferred_room_index must be a number or null." }, { status: 400 });
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  try {
    if (
      isLead &&
      patch.scholastic_year !== undefined &&
      normalizeScholasticYear(patch.scholastic_year) !== normalizeScholasticYear(klassExisting.scholastic_year)
    ) {
      const endingLabel = klassExisting.scholastic_year?.trim() || "Year not specified";
      await archiveScholasticYearAndResetReports({
        tenantId,
        classId,
        className: klassExisting.name,
        endingScholasticYearLabel: endingLabel,
      });
    }

    const klass = Object.keys(patch).length > 0 ? await updateClass(tenantId, classId, patch) : klassExisting;

    if (isLead && patch.default_output_language !== undefined) {
      await syncReportsLanguagesAfterClassOutputDefaultChange(
        tenantId,
        classId,
        patch.default_output_language,
        klassExisting.default_output_language,
      );
    }

    if (isLead && timetableRoomMoveTarget !== undefined) {
      try {
        await moveClassTimetableSlotsToRoom(tenantId, classId, timetableRoomMoveTarget);
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
