/**
 * Report dataset 4 — numeric grades (0–10) per your Prompt A1 structure:
 * 16 metrics × 3 term divisions (Term 1, Term 2, Term 3).
 * Row titles in English in this table are for storage/AI plaintext; the report PDF uses i18n from the output language.
 */

import { isSubjectCode, subjectLabel } from "@/lib/subjects";
import type { SubjectCode } from "@/lib/subjects";

export const METRIC_DIVISION_KEYS = ["classroom_behaviour", "direct_skills", "indirect_skills"] as const;
export type MetricDivisionKey = (typeof METRIC_DIVISION_KEYS)[number];

/** English division lines for AI / plaintext dumps (not for parent PDF). */
export const METRIC_DIVISION_LABEL_EN: Record<MetricDivisionKey, string> = {
  classroom_behaviour: "Classroom behaviour",
  direct_skills: "Direct skills",
  indirect_skills: "Indirect skills",
};

export const DATASET4_METRICS = [
  { key: "attendance", label: "Attendance", divisionKey: "classroom_behaviour" },
  { key: "punctuality", label: "Punctuality", divisionKey: "classroom_behaviour" },
  { key: "completes_homework", label: "Completes homework", divisionKey: "classroom_behaviour" },
  { key: "submits_homework_on_time", label: "Submits homework on time", divisionKey: "classroom_behaviour" },
  { key: "pays_attention_to_teacher", label: "Pays attention to the teacher", divisionKey: "classroom_behaviour" },
  { key: "avoids_distraction", label: "Avoids distraction from classmates", divisionKey: "classroom_behaviour" },
  { key: "takes_part_in_activities", label: "Takes part in classroom activities", divisionKey: "classroom_behaviour" },
  { key: "interacts_with_peers", label: "Interacts well with the other students", divisionKey: "classroom_behaviour" },
  { key: "reading", label: "Reading", divisionKey: "direct_skills" },
  { key: "writing", label: "Writing", divisionKey: "direct_skills" },
  { key: "listening", label: "Listening", divisionKey: "direct_skills" },
  { key: "speaking", label: "Speaking", divisionKey: "direct_skills" },
  { key: "pronunciation", label: "Pronunciation", divisionKey: "indirect_skills" },
  { key: "handwriting", label: "Handwriting", divisionKey: "indirect_skills" },
  { key: "audio_comprehension", label: "Audio Comprehension", divisionKey: "indirect_skills" },
  { key: "reading_comprehension", label: "Reading Comprehension", divisionKey: "indirect_skills" },
] as const;

export type Dataset4MetricKey = (typeof DATASET4_METRICS)[number]["key"];

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
        const v = b[k];
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

  return base;
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
function appendScoredMetricsForTerm(lines: string[], inputs: ReportInputs, termIdx: 0 | 1 | 2): boolean {
  let currentDiv: MetricDivisionKey | "" = "";
  let any = false;
  for (const m of DATASET4_METRICS) {
    const v = inputs.terms[termIdx][m.key];
    if (v === null || v === undefined) continue;
    any = true;
    if (m.divisionKey !== currentDiv) {
      currentDiv = m.divisionKey;
      lines.push(`[${METRIC_DIVISION_LABEL_EN[m.divisionKey]}]`);
    }
    lines.push(`- ${m.label}: ${String(v)} (0–10)`);
  }
  return any;
}

/** Flatten 0–10 grid into plaintext for OpenAI (only scored metrics; teacher prose notes are in the prompt separately). */
export function reportInputsToTeacherNotes(inputs: ReportInputs, subjectResolved: string): string {
  const lines: string[] = [];
  lines.push(`Subject: ${subjectResolved}`);
  if (isShortCourseReport(inputs)) {
    lines.push(`Short course — numeric scores below are the only rubric areas in scope for this comment.`);
    const t = 0 as const;
    const any = appendScoredMetricsForTerm(lines, inputs, t);
    if (!any) lines.push("(No 0–10 scores recorded for this course.)");
    const pct = termAveragePercent(inputs.terms[t]);
    if (pct !== null) lines.push(`Course aggregate: ${formatPercentSigFigs(pct, 2)}`);
    return lines.join("\n");
  }
  lines.push(`Report period (term focus): ${inputs.report_period}`);
  const termLabel = ["Term 1", "Term 2", "Term 3"];
  for (let t = 0; t < 3; t++) {
    lines.push(`--- ${termLabel[t]} ---`);
    const any = appendScoredMetricsForTerm(lines, inputs, t as 0 | 1 | 2);
    if (!any) lines.push("(No numeric scores recorded for this term.)");
    const pct = termAveragePercent(inputs.terms[t]);
    if (pct !== null) lines.push(`Term ${t + 1} aggregate: ${formatPercentSigFigs(pct, 2)}`);
  }
  const yearPct = yearAveragePercent(inputs);
  if (yearPct !== null) lines.push(`Year aggregate: ${formatPercentSigFigs(yearPct, 2)}`);
  return lines.join("\n");
}

export function resolvedSubjectCode(inputs: ReportInputs, classDefault: SubjectCode): SubjectCode {
  return inputs.subject_code ?? classDefault;
}

export function resolvedSubjectLabel(inputs: ReportInputs, classDefault: SubjectCode): string {
  return subjectLabel(resolvedSubjectCode(inputs, classDefault));
}
