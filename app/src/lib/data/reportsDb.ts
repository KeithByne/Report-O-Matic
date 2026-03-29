import type { ReportInputs } from "@/lib/reportInputs";
import { parseReportInputs } from "@/lib/reportInputs";
import type { ReportLanguageCode } from "@/lib/i18n/reportLanguages";
import { isReportLanguageCode } from "@/lib/i18n/reportLanguages";
import { getServiceSupabase } from "@/lib/supabase/service";

function formatErr(e: { message: string; details?: string | null; hint?: string | null }): string {
  const parts = [e.message, e.details, e.hint].filter((x): x is string => Boolean(x && String(x).trim()));
  return parts.join(" — ") || "Database error.";
}

export type ReportRow = {
  id: string;
  tenant_id: string;
  student_id: string;
  author_email: string;
  title: string | null;
  body: string;
  body_teacher_preview: string;
  teacher_preview_language: ReportLanguageCode;
  status: "draft" | "final";
  output_language: ReportLanguageCode;
  inputs: ReportInputs;
  created_at: string;
  updated_at: string;
};

const reportSelect =
  "id, tenant_id, student_id, author_email, title, body, body_teacher_preview, teacher_preview_language, status, output_language, inputs, created_at, updated_at";

function rowFromDb(data: Record<string, unknown>): ReportRow {
  const outLang = isReportLanguageCode(String(data.output_language)) ? (data.output_language as ReportLanguageCode) : "en";
  const teacherLang = isReportLanguageCode(String(data.teacher_preview_language))
    ? (data.teacher_preview_language as ReportLanguageCode)
    : "en";
  return {
    id: data.id as string,
    tenant_id: data.tenant_id as string,
    student_id: data.student_id as string,
    author_email: data.author_email as string,
    title: (data.title as string | null) ?? null,
    body: (data.body as string) ?? "",
    body_teacher_preview: typeof data.body_teacher_preview === "string" ? data.body_teacher_preview : "",
    teacher_preview_language: teacherLang,
    status: data.status as "draft" | "final",
    output_language: outLang,
    inputs: parseReportInputs(data.inputs),
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
  };
}

export async function listReportsForTenant(tenantId: string, studentId?: string): Promise<ReportRow[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return [];
  let q = supabase.from("reports").select(reportSelect)
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false });
  if (studentId) q = q.eq("student_id", studentId);
  const { data, error } = await q;
  if (error) throw new Error(formatErr(error));
  return (data ?? []).map((r) => rowFromDb(r as Record<string, unknown>));
}

export async function getReport(tenantId: string, reportId: string): Promise<ReportRow | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("reports")
    .select(reportSelect)
    .eq("tenant_id", tenantId)
    .eq("id", reportId)
    .maybeSingle();
  if (error) throw new Error(formatErr(error));
  return data ? rowFromDb(data as Record<string, unknown>) : null;
}

export async function insertReport(opts: {
  tenantId: string;
  studentId: string;
  authorEmail: string;
  title: string | null;
  body: string;
  outputLanguage: ReportLanguageCode;
  inputs: ReportInputs;
}): Promise<ReportRow> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("reports")
    .insert({
      tenant_id: opts.tenantId,
      student_id: opts.studentId,
      author_email: opts.authorEmail.trim().toLowerCase(),
      title: opts.title?.trim() || null,
      body: opts.body,
      status: "draft",
      output_language: opts.outputLanguage,
      inputs: opts.inputs as unknown as Record<string, unknown>,
      updated_at: now,
    })
    .select(reportSelect)
    .single();
  if (error) throw new Error(formatErr(error));
  return rowFromDb(data as Record<string, unknown>);
}

export async function updateReport(
  tenantId: string,
  reportId: string,
  patch: {
    title?: string | null;
    body?: string;
    body_teacher_preview?: string;
    teacher_preview_language?: ReportLanguageCode;
    status?: "draft" | "final";
    output_language?: ReportLanguageCode;
    inputs?: ReportInputs;
  },
): Promise<ReportRow> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.body !== undefined) row.body = patch.body;
  if (patch.body_teacher_preview !== undefined) row.body_teacher_preview = patch.body_teacher_preview;
  if (patch.teacher_preview_language !== undefined) row.teacher_preview_language = patch.teacher_preview_language;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.output_language !== undefined) row.output_language = patch.output_language;
  if (patch.inputs !== undefined) row.inputs = patch.inputs as unknown as Record<string, unknown>;
  const { data, error } = await supabase
    .from("reports")
    .update(row)
    .eq("tenant_id", tenantId)
    .eq("id", reportId)
    .select(reportSelect)
    .single();
  if (error) throw new Error(formatErr(error));
  return rowFromDb(data as Record<string, unknown>);
}
