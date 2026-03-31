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

export type ReportInputs = {
  schema_version: 2;
  /** Index 0 = Term 1, 1 = Term 2, 2 = Term 3 */
  terms: [TermGrades, TermGrades, TermGrades];
  /** Which term this report cycle refers to (dropdown on form). */
  report_period: ReportPeriod;
  /** Override class subject; null = use class default. */
  subject_code: SubjectCode | null;
  optional_teacher_notes: string;
};

const KEYS = DATASET4_METRICS.map((m) => m.key) as Dataset4MetricKey[];

function emptyTerm(): TermGrades {
  const o = {} as Record<Dataset4MetricKey, number | null>;
  for (const k of KEYS) o[k] = null;
  return o as TermGrades;
}

export function emptyReportInputs(): ReportInputs {
  return {
    schema_version: 2,
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
  if (o.schema_version !== 2) return base;

  if (o.report_period === "first" || o.report_period === "second" || o.report_period === "third") {
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

  return base;
}

export function termAveragePercent(term: TermGrades): number | null {
  const vals = KEYS.map((k) => term[k]).filter((v): v is number => v !== null && v !== undefined);
  if (vals.length !== 16) return null;
  const sum = vals.reduce((a, b) => a + b, 0);
  return Math.round((sum / 160) * 10000) / 100;
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

/** All rubric cells filled for the term selected as report period (Term 1 / 2 / 3). */
export function focusTermComplete(inputs: ReportInputs): boolean {
  const t = inputs.terms[focusTermIndex(inputs.report_period)];
  for (const k of KEYS) {
    if (t[k] === null || t[k] === undefined) return false;
  }
  return true;
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

/** Flatten 0–10 grid for OpenAI (grades only). Optional teacher context is passed separately in the AI prompt — not here. */
export function reportInputsToTeacherNotes(inputs: ReportInputs, subjectResolved: string): string {
  const lines: string[] = [];
  lines.push(`Subject context: ${subjectResolved}`);
  lines.push(`Report period (term focus): ${inputs.report_period}`);
  const termLabel = ["Term 1", "Term 2", "Term 3"];
  for (let t = 0; t < 3; t++) {
    lines.push(`--- ${termLabel[t]} ---`);
    let currentDiv: MetricDivisionKey | "" = "";
    for (const m of DATASET4_METRICS) {
      if (m.divisionKey !== currentDiv) {
        currentDiv = m.divisionKey;
        lines.push(`[${METRIC_DIVISION_LABEL_EN[m.divisionKey]}]`);
      }
      const v = inputs.terms[t][m.key];
      lines.push(`- ${m.label}: ${v === null || v === undefined ? "—" : String(v)} (0–10)`);
    }
    const pct = termAveragePercent(inputs.terms[t]);
    lines.push(`Term ${t + 1} aggregate (if complete): ${pct === null ? "—" : `${pct.toFixed(2)}%`}`);
  }
  return lines.join("\n");
}

export function resolvedSubjectCode(inputs: ReportInputs, classDefault: SubjectCode): SubjectCode {
  return inputs.subject_code ?? classDefault;
}

export function resolvedSubjectLabel(inputs: ReportInputs, classDefault: SubjectCode): string {
  return subjectLabel(resolvedSubjectCode(inputs, classDefault));
}
