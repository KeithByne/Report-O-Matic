import { NextResponse } from "next/server";
import { generateSchoolReportDraftPair } from "@/lib/ai/generateReportDraft";
import { estimateOpenAiCostUsd } from "@/lib/ai/openaiCost";
import { canAccessClass } from "@/lib/auth/classAccess";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { getClassInTenant } from "@/lib/data/classesDb";
import { getTenantCreditBalance, consumeCreditForReport } from "@/lib/data/credits";
import { getRoleForTenant, getTenantName } from "@/lib/data/memberships";
import { logOpenAiUsageEvent } from "@/lib/data/openaiUsageEvents";
import { getReport, updateReport } from "@/lib/data/reportsDb";
import { isReportLanguageCode } from "@/lib/i18n/reportLanguages";
import type { ReportInputs } from "@/lib/reportInputs";
import { focusTermComplete, focusTermIndex, isShortCourseReport, parseReportInputs } from "@/lib/reportInputs";
import { isSubjectCode } from "@/lib/subjects";
import { getServiceSupabase } from "@/lib/supabase/service";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function normalizeTeacherContext(s: string | null | undefined): string {
  return (s ?? "").trim().replace(/\s+/g, " ");
}

function teacherIndicatesNewToCourse(raw: string): boolean {
  const s = normalizeTeacherContext(raw).toLowerCase();
  if (!s) return false;
  // Common teacher phrases: "new to the course/class", "just started with us", etc.
  return (
    /\b(new to (the )?(course|class|group|school))\b/.test(s) ||
    /\b(just started( with us)?|only just started)\b/.test(s) ||
    /\b(has (only )?recently (joined|started))\b/.test(s) ||
    /\b(recently joined)\b/.test(s)
  );
}

function buildAttendanceContext(opts: {
  inputs: ReportInputs;
  hasPreviousReport: boolean;
  teacherContext: string;
}): string | null {
  const inputs = parseReportInputs(opts.inputs as unknown);
  if (isShortCourseReport(inputs)) return null;

  const period = inputs.report_period;
  const periodIdx = focusTermIndex(period);
  if (periodIdx === 0) return null; // first-term report doesn't need "previous term" assumptions

  const teacherSaysNew = teacherIndicatesNewToCourse(opts.teacherContext);
  if (!opts.hasPreviousReport || teacherSaysNew) {
    return [
      "Attendance / timeline context (mandatory):",
      "- If there is no previously saved report for earlier terms, assume the student did not attend earlier term(s).",
      "- If the teacher context says the student is new / has just started / is new to the class, treat them as a newcomer even if other data exists.",
      "- In that case, do not imply continuity from earlier terms; avoid phrases like “since the start of the year”, “over the year”, or “as the months progressed”.",
      "- Frame feedback as based on the time they have been with us so far, and be careful not to over-claim long-term progress.",
    ].join("\n");
  }
  return null;
}

export async function POST(req: Request, context: { params: Promise<{ tenantId: string; reportId: string }> }) {
  const { tenantId, reportId } = await context.params;
  if (!isUuid(tenantId) || !isUuid(reportId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;

  let notes = "";
  try {
    const j = (await req.json()) as { notes?: unknown };
    if (typeof j.notes === "string") notes = j.notes.trim();
  } catch {
    /* empty body ok */
  }

  const report = await getReport(tenantId, reportId);
  if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });

  const role = await getRoleForTenant(gate.email, tenantId);
  if (!role) return NextResponse.json({ error: "No access." }, { status: 403 });

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });

  const { data: student, error: sErr } = await supabase
    .from("students")
    .select("first_name, last_name, display_name, class_id, classes ( name )")
    .eq("id", report.student_id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (sErr || !student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  const schoolName = (await getTenantName(tenantId)) || "School";
  const row = student as {
    first_name: string | null;
    last_name: string | null;
    display_name: string;
    class_id: string;
    classes: { name: string } | { name: string }[] | null;
  };
  const firstName = (row.first_name?.trim() || row.display_name.split(/\s+/)[0] || "Student").trim();
  const cls = row.classes;
  const className =
    cls == null ? null : Array.isArray(cls) ? cls[0]?.name ?? null : typeof cls === "object" && "name" in cls ? cls.name : null;

  const klass = await getClassInTenant(tenantId, row.class_id);
  if (klass && !canAccessClass({ role, viewerEmail: gate.email, klass })) {
    return NextResponse.json({ error: "You do not have access to this report." }, { status: 403 });
  }
  const classDefaultSubject = klass?.default_subject && isSubjectCode(klass.default_subject) ? klass.default_subject : "efl";
  const pdfLang = isReportLanguageCode(report.output_language) ? report.output_language : "en";
  const teacherLang = isReportLanguageCode(report.teacher_preview_language)
    ? report.teacher_preview_language
    : pdfLang;

  const savedNotes = report.inputs.optional_teacher_notes?.trim() ?? "";
  const requestNotes = notes.trim();
  const baseNotes = requestNotes || savedNotes || "";

  // If there is no previous report saved, the model must assume non-attendance for earlier terms.
  // Also, teacher "new to course/class" wording must override generic assumptions.
  let hasPreviousReport = false;
  try {
    const { data: prevAny } = await supabase
      .from("reports")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("student_id", report.student_id)
      .neq("id", report.id)
      .limit(1);
    hasPreviousReport = Array.isArray(prevAny) && prevAny.length > 0;
  } catch {
    // If this fails, default to "unknown" (don't force the assumption).
    hasPreviousReport = true;
  }

  const attendanceContext = buildAttendanceContext({
    inputs: report.inputs,
    hasPreviousReport,
    teacherContext: baseNotes,
  });

  const extraNotes = [attendanceContext, baseNotes.trim() || null].filter(Boolean).join("\n\n") || undefined;

  try {
    const bal = await getTenantCreditBalance(tenantId);
    if (bal <= 0) {
      return NextResponse.json({ error: "No report credits. Please ask the owner to purchase a pack." }, { status: 402 });
    }
    const { pdfBody, teacherPreview, usage } = await generateSchoolReportDraftPair({
      studentFirstName: firstName,
      className,
      schoolName,
      pdfLanguage: pdfLang,
      teacherLanguage: teacherLang,
      classDefaultSubject,
      inputs: report.inputs,
      extraNotes,
      classCefrLevel: klass?.cefr_level ?? null,
    });
    if (usage.draft) {
      await logOpenAiUsageEvent({
        tenantId,
        reportId,
        actorEmail: gate.email,
        kind: "draft",
        model: usage.draft.model,
        promptTokens: usage.draft.prompt_tokens,
        completionTokens: usage.draft.completion_tokens,
        totalTokens: usage.draft.total_tokens,
        estCostUsd: estimateOpenAiCostUsd(usage.draft),
      });
    }
    if (usage.translate) {
      await logOpenAiUsageEvent({
        tenantId,
        reportId,
        actorEmail: gate.email,
        kind: "translate",
        model: usage.translate.model,
        promptTokens: usage.translate.prompt_tokens,
        completionTokens: usage.translate.completion_tokens,
        totalTokens: usage.translate.total_tokens,
        estCostUsd: estimateOpenAiCostUsd(usage.translate),
      });
    }
    const inputsParsed = parseReportInputs(report.inputs);
    const termIdx = isShortCourseReport(inputsParsed) ? 0 : focusTermIndex(inputsParsed.report_period);
    const prevFlags = inputsParsed.comment_generated_for_terms;
    const nextFlags: [boolean, boolean, boolean] = prevFlags
      ? [prevFlags[0], prevFlags[1], prevFlags[2]]
      : [false, false, false];
    nextFlags[termIdx] = true;
    const mergedInputs: ReportInputs = { ...inputsParsed, comment_generated_for_terms: nextFlags };

    const markFinal = focusTermComplete(inputsParsed) && pdfBody.trim().length > 0;
    const updated = await updateReport(tenantId, reportId, {
      body: pdfBody,
      body_teacher_preview: teacherPreview,
      teacher_preview_language: teacherLang,
      inputs: mergedInputs,
      ...(markFinal ? { status: "final" as const } : {}),
    });

    // Consume 1 report credit once per report (idempotent).
    await consumeCreditForReport({ tenantId, reportId });
    return NextResponse.json({ report: updated });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "AI generation failed.";
    console.error("[ROM ai]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
