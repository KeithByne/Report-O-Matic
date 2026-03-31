import { NextResponse } from "next/server";
import { generateSchoolReportDraftPair } from "@/lib/ai/generateReportDraft";
import { estimateOpenAiCostUsd } from "@/lib/ai/openaiCost";
import { canAccessClass } from "@/lib/auth/classAccess";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { getClassInTenant } from "@/lib/data/classesDb";
import { getRoleForTenant, getTenantName } from "@/lib/data/memberships";
import { logOpenAiUsageEvent } from "@/lib/data/openaiUsageEvents";
import { getReport, updateReport } from "@/lib/data/reportsDb";
import { isReportLanguageCode } from "@/lib/i18n/reportLanguages";
import { isSubjectCode } from "@/lib/subjects";
import { getServiceSupabase } from "@/lib/supabase/service";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
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
  const extraNotes = requestNotes || savedNotes || undefined;

  try {
    const { pdfBody, teacherPreview, usage } = await generateSchoolReportDraftPair({
      studentFirstName: firstName,
      className,
      schoolName,
      pdfLanguage: pdfLang,
      teacherLanguage: teacherLang,
      classDefaultSubject,
      inputs: report.inputs,
      extraNotes,
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
    const updated = await updateReport(tenantId, reportId, {
      body: pdfBody,
      body_teacher_preview: teacherPreview,
      teacher_preview_language: teacherLang,
    });
    return NextResponse.json({ report: updated });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "AI generation failed.";
    console.error("[ROM ai]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
