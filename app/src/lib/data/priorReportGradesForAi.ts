import type { SupabaseClient } from "@supabase/supabase-js";
import type { MetricLabelsContext } from "@/lib/classMetricLabels";
import {
  DATASET4_METRICS,
  focusTermIndex,
  formatTermGradesBlock,
  isShortCourseReport,
  parseReportInputs,
  type ReportInputs,
  type ReportPeriod,
  type TermGrades,
} from "@/lib/reportInputs";
import { normalizeScholasticYearLabel } from "@/lib/scholasticYear";

export type PriorStoredTermReport = {
  reportPeriod: ReportPeriod;
  termIndex: 0 | 1 | 2;
  inputs: ReportInputs;
};

/**
 * Earlier standard reports for the same student in the current class scholastic year.
 * Term 1 report is omitted when generating Term 2/3; only strictly earlier `report_period` rows.
 */
export async function listPriorStandardReportsSameScholasticYear(
  supabase: SupabaseClient,
  opts: {
    tenantId: string;
    studentId: string;
    currentReportId: string;
    currentPeriod: ReportPeriod;
    classScholasticYear: string | null;
  },
): Promise<PriorStoredTermReport[]> {
  const currentIdx = focusTermIndex(opts.currentPeriod);
  if (currentIdx === 0) return [];

  const yearNorm = normalizeScholasticYearLabel(opts.classScholasticYear);
  if (!yearNorm) return [];

  const { data: studentRow, error: stErr } = await supabase
    .from("students")
    .select("class_id, classes ( scholastic_year )")
    .eq("id", opts.studentId)
    .eq("tenant_id", opts.tenantId)
    .maybeSingle();
  if (stErr || !studentRow) return [];

  const cls = studentRow.classes as { scholastic_year: string | null } | { scholastic_year: string | null }[] | null;
  const classYear =
    cls == null
      ? ""
      : Array.isArray(cls)
        ? normalizeScholasticYearLabel(cls[0]?.scholastic_year)
        : normalizeScholasticYearLabel(cls.scholastic_year);
  if (classYear !== yearNorm) return [];

  const { data: rows, error } = await supabase
    .from("reports")
    .select("id, inputs, updated_at")
    .eq("tenant_id", opts.tenantId)
    .eq("student_id", opts.studentId)
    .neq("id", opts.currentReportId)
    .order("updated_at", { ascending: true });
  if (error || !rows?.length) return [];

  const priors: PriorStoredTermReport[] = [];
  for (const row of rows) {
    const inputs = parseReportInputs(row.inputs);
    if (isShortCourseReport(inputs)) continue;
    const idx = focusTermIndex(inputs.report_period);
    if (idx >= currentIdx) continue;
    priors.push({ reportPeriod: inputs.report_period, termIndex: idx, inputs });
  }

  priors.sort((a, b) => a.termIndex - b.termIndex);
  return priors;
}

/** Term rubric grids from earlier saved reports (and legacy same-document slots) for the grade editor. */
export function buildEditorPriorTermsGrades(
  priors: PriorStoredTermReport[],
  localInputs: ReportInputs,
): [TermGrades | null, TermGrades | null, TermGrades | null] {
  const out: [TermGrades | null, TermGrades | null, TermGrades | null] = [null, null, null];
  for (const p of priors) {
    out[p.termIndex] = p.inputs.terms[p.termIndex];
  }
  for (let i = 0; i < 3; i++) {
    if (out[i]) continue;
    const t = localInputs.terms[i];
    const hasAny = DATASET4_METRICS.some((m) => t[m.key] !== null && t[m.key] !== undefined);
    if (hasAny) out[i] = t;
  }
  return out;
}

export function formatPriorStoredTermsDatasetBlock(
  priors: PriorStoredTermReport[],
  subjectLine: string,
  labels: MetricLabelsContext,
): string {
  if (priors.length === 0) return "";
  const lines: string[] = [
    "Prior term grades from other saved reports for this student in the same scholastic year (use only to describe progress or trends into the current report period; not the period under review):",
    `Subject: ${subjectLine}`,
  ];
  const termLabel = ["Term 1", "Term 2", "Term 3"];
  for (const p of priors) {
    lines.push(`--- ${termLabel[p.termIndex]} (saved report; report_period=${p.reportPeriod}) ---`);
    lines.push(formatTermGradesBlock(p.inputs, p.termIndex, labels));
  }
  return lines.join("\n");
}
