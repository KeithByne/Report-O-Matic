/**
 * Standard (term-based) school report comment prompts sent to OpenAI.
 * Short courses use `shortCourseReportCommentPrompt.ts` by default; subject overrides: `reportCommentPromptRegistry.ts`.
 */

import type { CefrLevel } from "@/lib/data/classesDb";
import type { SubjectCode } from "@/lib/subjects";

/** A1–B1: do not suggest homework or extra work outside class in AI report comments. */
export function homeworkAdviceRestrictionForCefr(cefr: CefrLevel | null | undefined): string {
  if (cefr !== "A1" && cefr !== "A2" && cefr !== "B1") return "";
  return `Class CEFR level is ${cefr} (at or below B1). Do not suggest extra work at home, homework, or independent study outside scheduled class time. Do not advise parents to assign practice or revision at home. Keep improvement ideas and next steps within lesson time and school-supported learning only; you may still encourage participation and effort in class.`;
}

/**
 * Standard term-based reports: the model must not hallucinate missing rubric data or
 * reference terms after the focused report period.
 */
export function standardReportSequentialDataRules(): string {
  return `Sequential reporting and incomplete data (mandatory):
- Reports are written in calendar order: first term, then second, then third. Your narrative must align only with the **report period** named in the structured data ("Report period (term focus)").
- Never mention, imply, or invent grades, averages, trends, or qualitative judgments for any metric or term that is not supported by a numeric score in the dataset. If the dataset shows an empty placeholder (—) or a missing value, that information does not exist yet—the school year has not reached that point. Do not guess, generalise, or "fill in" those gaps.
- Do not refer to **later** terms than the focused report period. For example: a first-term report must not reference second- or third-term outcomes; a second-term report must not reference third-term outcomes. Information that belongs to a following term must never appear in a report for a preceding term.
- Do not preview, promise, or hedge about results or themes that would belong to a future term relative to the focused period.`;
}

/** Short-course snapshot: no discussion of missing rubric cells or invented metrics. */
export function shortCourseReportDataCompletenessRules(): string {
  return `Incomplete data (mandatory):
- Comment only on metrics and aggregates that appear in the course rubric with explicit numeric scores. Empty placeholders (—) mean not yet recorded or not in scope for this comment; do not invent values, do not discuss those areas as if they were known, and do not imply outcomes that are not in the dataset.`;
}

export type ReportDraftPromptContext = {
  /** Resolved subject code (class default or report override). */
  subjectCode: SubjectCode;
  /** e.g. "British English", "French" — from LANGUAGE_INSTRUCTION / languageLabel */
  langName: string;
  studentFirstName: string;
  schoolName: string;
  className: string | null;
  /** Human-readable subject label (e.g. "English as a Foreign Language"). */
  subjectLine: string;
  /** From reportInputsToTeacherNotes (term sections for standard; single rubric block for short course). */
  datasetBlock: string;
  extraNotes?: string;
  existingBody?: string;
  /** Class CEFR; when A1–B1, prompts forbid advising homework / extra work at home. */
  classCefrLevel?: CefrLevel | null;
};

/** Temperature for the OpenAI completion when generating a standard report comment draft. */
export const STANDARD_REPORT_DRAFT_TEMPERATURE = 0.55;

/**
 * Original standard report: system message + user message exactly as for multi-term reports.
 */
export function buildStandardReportDraftPrompts(ctx: ReportDraftPromptContext): {
  system: string;
  user: string;
  temperature: number;
} {
  const cefrBlock = homeworkAdviceRestrictionForCefr(ctx.classCefrLevel);
  const sequentialBlock = standardReportSequentialDataRules();
  const system = `You write school report comments for parents (English as a foreign language / similar contexts). 
The report narrative must be written entirely in ${ctx.langName}. Do not use another language for the main text.
Maximum length 1400 characters. Plain paragraphs only (no markdown headings).
Use only the student's first name (${ctx.studentFirstName}) — do not use or invent a surname.
Base the appraisal on the numerical 0–10 dataset supplied; be fair and specific.
${sequentialBlock}${cefrBlock ? `\n${cefrBlock}` : ""}`;

  const user = [
    `School: ${ctx.schoolName}`,
    ctx.className ? `Class: ${ctx.className}` : "",
    `Student first name (only name to use in text): ${ctx.studentFirstName}`,
    `Subject: ${ctx.subjectLine}`,
    `Structured numerical data and term labels:\n${ctx.datasetBlock}`,
    ctx.extraNotes
      ? `Teacher context (use when shaping the comment for parents; do not quote or label this block; weave in fairly if relevant):\n${ctx.extraNotes}`
      : "",
    ctx.existingBody
      ? `Revise or replace this draft (keep facts consistent with the dataset and the sequential-term rules; do not introduce later terms or missing scores):\n${ctx.existingBody}`
      : cefrBlock
        ? "Write a complete comment: opening strength, honest middle where grades are low, end positive with in-lesson next steps only (no homework or independent work at home). Use only scores and terms that are actually present for the focused report period; never discuss empty (—) cells or later terms."
        : "Write a complete comment: opening strength, honest middle where grades are low, end positive with next steps. Use only scores and terms that are actually present for the focused report period; never discuss empty (—) cells or later terms.",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { system, user, temperature: STANDARD_REPORT_DRAFT_TEMPERATURE };
}
