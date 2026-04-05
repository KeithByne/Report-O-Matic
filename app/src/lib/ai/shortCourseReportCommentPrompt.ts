/**
 * Short-course-only OpenAI prompts (when `report_kind === "short_course"`).
 * Standard (term-based) prompts: `reportCommentPrompts.ts`.
 */

import type { ReportDraftPromptContext } from "@/lib/ai/reportCommentPrompts";
import {
  homeworkAdviceRestrictionForCefr,
  shortCourseReportDataCompletenessRules,
} from "@/lib/ai/reportCommentPrompts";

/** Matches standard report draft temperature; `max_tokens` stays in `generateReportDraft.ts`. */
export const SHORT_COURSE_REPORT_DRAFT_TEMPERATURE = 0.55;

export function buildShortCourseReportDraftPrompts(ctx: ReportDraftPromptContext): {
  system: string;
  user: string;
  temperature: number;
} {
  const cefrBlock = homeworkAdviceRestrictionForCefr(ctx.classCefrLevel);
  const dataCompletenessBlock = shortCourseReportDataCompletenessRules();
  const selfImproveLine = cefrBlock
    ? "Frame any improvement suggestions around effort and participation during the course sessions only — not tasks or practice outside scheduled class time."
    : "Any comments about what the student can do to improve are made in the context of what the student can do for themselves.";
  const system = `You write school report comments for parents (English as a foreign language / similar contexts). 
The student has attended a stand-alone course of short duration. 
The comments are written in a context of how the student has evolved during the short course.
The student will not be returning to any future courses.
${selfImproveLine}
The report narrative must be written entirely in ${ctx.langName}. Do not use another language for the main text.
Maximum length 1400 characters. Plain paragraphs only (no markdown headings).
Use only the student's first name (${ctx.studentFirstName}) — do not use or invent a surname.
Base the appraisal solely on the numerical 0–10 lines supplied; each line is an in-scope topic. Be fair and specific.
${dataCompletenessBlock}
In the comment text itself, never use the English word "term" or calendar labels for school reporting slices (e.g. trimester, trimestre, semester, Schultrimester, "marking period"). Refer only to the course or the programme. Write in ${ctx.langName} without importing phrasing from year-long school reports.${cefrBlock ? `\n${cefrBlock}` : ""}`;

  const user = [
    `School: ${ctx.schoolName}`,
    ctx.className ? `Class: ${ctx.className}` : "",
    `Student first name (only name to use in text): ${ctx.studentFirstName}`,
    `Subject: ${ctx.subjectLine}`,
    `Course rubric data — single 0–10 snapshot for this short course only. Your comment must stay in that frame (not a full-year school timeline):\n${ctx.datasetBlock}`,
    ctx.extraNotes
      ? `Teacher context (use when shaping the comment for parents; do not quote or label this block; weave in fairly if relevant):\n${ctx.extraNotes}`
      : "",
    ctx.existingBody
      ? `Revise or replace this draft (keep facts consistent with the dataset):\n${ctx.existingBody}`
      : cefrBlock
        ? "Write a complete comment: opening strength, honest middle where grades are low, end with encouragement and a positive closing focused on what happened in the course — no homework or independent study at home, no calendar-slice or school-period vocabulary, no implication of further courses with the same teacher. Only discuss rubric dimensions that appear as scored lines in the data; do not name or imply any unscored area."
        : "Write a complete comment: opening strength, honest middle where grades are low, end with encouragement and ideas the student can use going forward — no calendar-slice or school-period vocabulary, no implication of further courses with the same teacher. Only discuss rubric dimensions that appear as scored lines in the data; do not name or imply any unscored area.",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { system, user, temperature: SHORT_COURSE_REPORT_DRAFT_TEMPERATURE };
}
