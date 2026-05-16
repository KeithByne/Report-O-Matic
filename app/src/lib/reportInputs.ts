/**
 * Report dataset 4 — numeric grades (0–10) per your Prompt A1 structure:
 * 16 metrics × 3 term divisions (Term 1, Term 2, Term 3).
 * Row titles in English in this table are for storage/AI plaintext; the report PDF uses i18n from the output language.
 */

import type { MetricLabelsContext } from "@/lib/classMetricLabels";
import { resolveMetricLabel } from "@/lib/classMetricLabels";
import {
  DATASET4_METRICS,
  LEGACY_METRIC_KEY_BY_CANONICAL,
  type Dataset4MetricKey,
  type MetricDivisionKey,
} from "@/lib/dataset4Metrics";
import { gradeRubricForClassDefaultSubject } from "@/lib/gradeRubricProfile";
import type { GradeRubricProfile } from "@/lib/gradeRubricProfile";
import { parseGradeRubricProfile } from "@/lib/gradeRubricProfile";
import { metricDivisionHeadingEnForRubric } from "@/lib/i18n/gradeRubricLabels";
import { isSubjectCode, subjectLabel } from "@/lib/subjects";
import type { SubjectCode } from "@/lib/subjects";

export {
  DATASET4_METRICS,
  LEGACY_METRIC_KEY_BY_CANONICAL,
  METRIC_DIVISION_KEYS,
  METRIC_DIVISION_LABEL_EN,
} from "@/lib/dataset4Metrics";
export type { Dataset4MetricKey, MetricDivisionKey } from "@/lib/dataset4Metrics";

export type TermGrades = Record<Dataset4MetricKey, number | null>;

export type ReportPeriod = "first" | "second" | "third";

export type ReportKind = "standard" | "short_course";

export type ReportInputs = {
  /** v2 legacy standard; v3 may be standard or short_course. */
  schema_version: 2 | 3;
  report_kind: ReportKind;
  /** Index 0 = Term 1, 1 = Term 2, 2 = Term 3 */
  terms: [TermGrades, TermGrades, TermGrades];
  /** Which term this report cycle refers to (dropdown on form). */
  report_period: ReportPeriod;
  /** Override class subject; null = use class default. */
  subject_code: SubjectCode | null;
  optional_teacher_notes: string;
  /**
   * After a successful “Generate comment and save data” (AI) run, the term index (0–2) is set true.
   * Classes readiness uses this so the indicator does not depend on all 16 rubric cells being filled.
   */
  comment_generated_for_terms?: [boolean, boolean, boolean];
  /** Snapshot rubric for grade row titles / AI; set when the report is created or refreshed from class + tenant list. */
  grade_rubric_profile?: GradeRubricProfile;
};

export function isShortCourseReport(inputs: ReportInputs): boolean {
  return inputs.report_kind === "short_course";
}

const KEYS = DATASET4_METRICS.map((m) => m.key) as Dataset4MetricKey[];

function emptyTerm(): TermGrades {
  const o = {} as Record<Dataset4MetricKey, number | null>;
  for (const k of KEYS) o[k] = null;
  return o as TermGrades;
}

export function emptyReportInputs(): ReportInputs {
  return {
    schema_version: 2,
    report_kind: "standard",
    terms: [emptyTerm(), emptyTerm(), emptyTerm()],
    report_period: "first",
    subject_code: null,
    optional_teacher_notes: "",
  };
}

/** End-of-short-course report: one rubric block (stored as term 1), single field narrative. */
export function emptyShortCourseReportInputs(): ReportInputs {
  return {
    schema_version: 3,
    report_kind: "short_course",
    terms: [emptyTerm(), emptyTerm(), emptyTerm()],
    report_period: "first",
    subject_code: null,
    optional_teacher_notes: "",
  };
}

export function parseReportInputs(raw: unknown): ReportInputs {
  const base = emptyReportInputs();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const sv = o.schema_version;
  if (sv !== 2 && sv !== 3) return base;

  base.schema_version = sv === 3 ? 3 : 2;
  base.report_kind = o.report_kind === "short_course" ? "short_course" : "standard";
  if (base.report_kind === "short_course") {
    base.schema_version = 3;
    base.report_period = "first";
  } else if (o.report_period === "first" || o.report_period === "second" || o.report_period === "third") {
    base.report_period = o.report_period;
  }
  if (o.subject_code === null) base.subject_code = null;
  else if (typeof o.subject_code === "string" && isSubjectCode(o.subject_code)) base.subject_code = o.subject_code;
  if (typeof o.optional_teacher_notes === "string") base.optional_teacher_notes = o.optional_teacher_notes;

  if (Array.isArray(o.terms) && o.terms.length === 3) {
    const parsed: [TermGrades, TermGrades, TermGrades] = [emptyTerm(), emptyTerm(), emptyTerm()];
    for (let t = 0; t < 3; t++) {
      const block = o.terms[t];
      if (!block || typeof block !== "object") continue;
      const b = block as Record<string, unknown>;
      for (const k of KEYS) {
        let v = b[k];
        if ((v === null || v === undefined) && LEGACY_METRIC_KEY_BY_CANONICAL[k]) {
          v = b[LEGACY_METRIC_KEY_BY_CANONICAL[k]!];
        }
        if (v === null || v === undefined) parsed[t][k] = null;
        else if (typeof v === "number" && v >= 0 && v <= 10 && Number.isInteger(v)) parsed[t][k] = v;
        else if (typeof v === "string" && /^\d+$/.test(v)) {
          const n = parseInt(v, 10);
          if (n >= 0 && n <= 10) parsed[t][k] = n;
        }
      }
    }
    base.terms = parsed;
  }

  const cgt = o.comment_generated_for_terms;
  if (Array.isArray(cgt) && cgt.length === 3) {
    base.comment_generated_for_terms = [cgt[0] === true, cgt[1] === true, cgt[2] === true];
  }

  if ("grade_rubric_profile" in o) {
    base.grade_rubric_profile = parseGradeRubricProfile(o.grade_rubric_profile, "secondary");
  }

  return base;
}

/** Rubric for grades / AI: preset `subject_code` → language; else snapshot; else class column; else subject + tenant map. */
export function gradeRubricForReport(
  inputs: ReportInputs,
  classDefaultSubject: string,
  customRubricByNameLower: ReadonlyMap<string, GradeRubricProfile>,
  classStoredRubric?: GradeRubricProfile | null,
): GradeRubricProfile {
  if (inputs.subject_code && isSubjectCode(inputs.subject_code)) return "language";
  if (inputs.grade_rubric_profile) return inputs.grade_rubric_profile;
  if (classStoredRubric) return classStoredRubric;
  return gradeRubricForClassDefaultSubject(classDefaultSubject, customRubricByNameLower);
}

/**
 * True if an existing report occupies the same “slot” as a new report from the class list:
 * standard reports conflict when `report_period` matches; short course conflicts with any existing short course.
 */
export function existingReportConflictsWithNewReport(
  existingInputs: ReportInputs,
  newKind: ReportKind,
  newStandardPeriod: ReportPeriod,
): boolean {
  if (newKind === "short_course") return isShortCourseReport(existingInputs);
  if (isShortCourseReport(existingInputs)) return false;
  return existingInputs.report_period === newStandardPeriod;
}

export function findConflictingReportIdForNewReport(
  existing: { id: string; inputs: unknown }[],
  newKind: ReportKind,
  newStandardPeriod: ReportPeriod,
): string | null {
  for (const row of existing) {
    const inputs = parseReportInputs(row.inputs);
    if (existingReportConflictsWithNewReport(inputs, newKind, newStandardPeriod)) return row.id;
  }
  return null;
}

/** AI reliability hint: standard uses full grid; short course uses the focused term only (16 cells). */
export function rubricCompleteForAi(inputs: ReportInputs): boolean {
  return isShortCourseReport(inputs) ? focusTermComplete(inputs) : allTermsComplete(inputs);
}

/**
 * Mean of entered 0–10 scores for the term, as a percentage (100% = all 10s).
 * Null entries are treated as not applicable and excluded. Returns null if none entered.
 */
export function termAveragePercent(term: TermGrades): number | null {
  const vals = KEYS.map((k) => term[k]).filter((v): v is number => v !== null && v !== undefined);
  if (vals.length === 0) return null;
  const sum = vals.reduce((a, b) => a + b, 0);
  return (sum / (vals.length * 10)) * 100;
}

/** Mean of all entered scores across terms 1–3, as a percentage. Null if none entered. */
export function yearAveragePercent(inputs: ReportInputs): number | null {
  if (isShortCourseReport(inputs)) return null;
  const vals: number[] = [];
  for (let t = 0; t < 3; t++) {
    for (const k of KEYS) {
      const v = inputs.terms[t][k];
      if (v !== null && v !== undefined) vals.push(v);
    }
  }
  if (vals.length === 0) return null;
  const sum = vals.reduce((a, b) => a + b, 0);
  return (sum / (vals.length * 10)) * 100;
}

/** Format a 0–100 percentage for display with `sig` significant figures (e.g. 2 → 87%, 8.7%). */
export function formatPercentSigFigs(percent: number, sig: number): string {
  if (!Number.isFinite(percent)) return "—";
  if (percent === 0) return "0%";
  const p = Math.abs(percent);
  const exp = Math.floor(Math.log10(p));
  const magnitude = Math.pow(10, sig - 1 - exp);
  const rounded = Math.round(percent * magnitude) / magnitude;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return `${Math.round(rounded)}%`;
  const s = String(rounded);
  return `${s}%`;
}

export function allTermsComplete(inputs: ReportInputs): boolean {
  for (let t = 0; t < 3; t++) {
    for (const k of KEYS) {
      const v = inputs.terms[t][k];
      if (v === null || v === undefined) return false;
    }
  }
  return true;
}

export function focusTermIndex(reportPeriod: ReportPeriod): 0 | 1 | 2 {
  if (reportPeriod === "first") return 0;
  if (reportPeriod === "second") return 1;
  return 2;
}

/** Display label for class list / buttons: 1 = first term, 2 = second, 3 = third. */
export function reportPeriodTermNumber(period: ReportPeriod): 1 | 2 | 3 {
  if (period === "first") return 1;
  if (period === "second") return 2;
  return 3;
}

/** All rubric cells filled for the term selected as report period (Term 1 / 2 / 3). */
export function focusTermComplete(inputs: ReportInputs): boolean {
  const t = inputs.terms[focusTermIndex(inputs.report_period)];
  for (const k of KEYS) {
    if (t[k] === null || t[k] === undefined) return false;
  }
  return true;
}

/** All rubric cells filled for a specific term (ignores `inputs.report_period`). */
export function termCompleteForPeriod(inputs: ReportInputs, period: ReportPeriod): boolean {
  const t = inputs.terms[focusTermIndex(period)];
  for (const k of KEYS) {
    if (t[k] === null || t[k] === undefined) return false;
  }
  return true;
}

/**
 * Classes dashboard term readiness (1/2/3): term is “done” if AI set `comment_generated_for_terms[idx]`,
 * or (legacy) non-empty parent `body` with `report_period === period`. PATCH merges stored inputs so AI
 * flags are not dropped when the client omits them in JSON.
 */
export function reportTermReadyForClassesDashboard(
  r: { inputs: ReportInputs; body: string },
  period: ReportPeriod,
): boolean {
  const inputs = r.inputs;
  const bodyOk = r.body.trim().length > 0;
  if (isShortCourseReport(inputs)) {
    if (period !== "first") return false;
    if (inputs.comment_generated_for_terms?.[0] === true) return true;
    return bodyOk;
  }
  const idx = focusTermIndex(period);
  if (inputs.comment_generated_for_terms?.[idx] === true) return true;
  // Legacy / current cycle: parent-facing text saved for this report’s active term (must not be blocked
  // when comment_generated_for_terms exists but a PATCH omitted preserving flags — see report PATCH merge).
  if (bodyOk && inputs.report_period === period) return true;
  return false;
}

/**
 * Class bulk PDF: include when the report has parent-facing text and is either marked final,
 * or (draft) has a complete grade grid for the report period.
 */
export function reportReadyForClassBulkPdf(args: {
  status: "draft" | "final";
  body: string;
  inputs: ReportInputs;
}): boolean {
  if (!args.body.trim()) return false;
  if (args.status === "final") return true;
  return focusTermComplete(args.inputs);
}

/** Keeps status aligned with whether the report has PDF text and (if draft) a complete rubric for the report period. */
export function nextReportStatusFromContent(args: {
  prev: "draft" | "final";
  body: string;
  inputs: ReportInputs;
}): "draft" | "final" {
  return reportReadyForClassBulkPdf({
    status: args.prev,
    body: args.body,
    inputs: args.inputs,
  })
    ? "final"
    : "draft";
}

/** Query `term=` for class PDF batch: merge all ready rows, or only rows for one report period. */
export type ClassBulkPdfTermFilter = "all" | ReportPeriod;

export function parseClassBulkPdfTermFilter(raw: string | null | undefined): ClassBulkPdfTermFilter {
  const s = (raw ?? "").trim().toLowerCase();
  if (s === "first" || s === "1") return "first";
  if (s === "second" || s === "2") return "second";
  if (s === "third" || s === "3") return "third";
  return "all";
}

/**
 * Append only metrics that have a numeric score so OpenAI does not see unscored skill names
 * (avoids comments about homework, reading, etc. when those cells were left empty).
 */
function appendScoredMetricsForTerm(
  lines: string[],
  inputs: ReportInputs,
  termIdx: 0 | 1 | 2,
  labels: MetricLabelsContext,
): boolean {
  let currentDiv: MetricDivisionKey | "" = "";
  let any = false;
  for (const m of DATASET4_METRICS) {
    const v = inputs.terms[termIdx][m.key];
    if (v === null || v === undefined) continue;
    any = true;
    if (m.divisionKey !== currentDiv) {
      currentDiv = m.divisionKey;
      lines.push(`[${metricDivisionHeadingEnForRubric(m.divisionKey, labels.rubric)}]`);
    }
    lines.push(`- ${resolveMetricLabel(labels, m.key)}: ${String(v)} (0–10)`);
  }
  return any;
}

/** Flatten 0–10 grid into plaintext for OpenAI (only scored metrics; teacher prose notes are in the prompt separately). */
export function reportInputsToTeacherNotes(
  inputs: ReportInputs,
  subjectResolved: string,
  labels: MetricLabelsContext,
): string {
  const lines: string[] = [];
  lines.push(`Subject: ${subjectResolved}`);
  if (isShortCourseReport(inputs)) {
    lines.push(`Short course — numeric scores below are the only rubric areas in scope for this comment.`);
    const t = 0 as const;
    const any = appendScoredMetricsForTerm(lines, inputs, t, labels);
    if (!any) lines.push("(No 0–10 scores recorded for this course.)");
    const pct = termAveragePercent(inputs.terms[t]);
    if (pct !== null) lines.push(`Course aggregate: ${formatPercentSigFigs(pct, 2)}`);
    return lines.join("\n");
  }
  lines.push(`Report period (term focus): ${inputs.report_period}`);
  const termLabel = ["Term 1", "Term 2", "Term 3"];
  for (let t = 0; t < 3; t++) {
    lines.push(`--- ${termLabel[t]} ---`);
    const any = appendScoredMetricsForTerm(lines, inputs, t as 0 | 1 | 2, labels);
    if (!any) lines.push("(No numeric scores recorded for this term.)");
    const pct = termAveragePercent(inputs.terms[t]);
    if (pct !== null) lines.push(`Term ${t + 1} aggregate: ${formatPercentSigFigs(pct, 2)}`);
  }
  const yearPct = yearAveragePercent(inputs);
  if (yearPct !== null) lines.push(`Year aggregate: ${formatPercentSigFigs(yearPct, 2)}`);
  return lines.join("\n");
}

/**
 * Subject code used for AI prompt routing (registry keys). Custom class defaults map to `efl`
 * when the report does not override with a preset code.
 */
export function resolvedSubjectCodeForPrompts(inputs: ReportInputs, classDefault: string): SubjectCode {
  if (inputs.subject_code) return inputs.subject_code;
  const low = classDefault.trim().toLowerCase();
  return isSubjectCode(low) ? low : "efl";
}

/** English plaintext subject line for AI / teacher notes (custom class default preserved). */
export function resolvedSubjectLineForAi(inputs: ReportInputs, classDefault: string): string {
  if (inputs.subject_code) return subjectLabel(inputs.subject_code);
  const raw = classDefault.trim();
  if (raw && !isSubjectCode(raw.toLowerCase())) return raw;
  return subjectLabel(resolvedSubjectCodeForPrompts(inputs, classDefault));
}
