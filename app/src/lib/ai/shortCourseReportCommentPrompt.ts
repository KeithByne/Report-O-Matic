/**
 * Short-course-only OpenAI prompts (when `report_kind === "short_course"`).
 * Standard (term-based) prompts: `reportCommentPrompts.ts`.
 */

import type { ReportDraftPromptContext } from "@/lib/ai/reportCommentPrompts";

/** Matches standard report draft temperature; `max_tokens` stays in `generateReportDraft.ts`. */
export const SHORT_COURSE_REPORT_DRAFT_TEMPERATURE = 0.55;

export function buildShortCourseReportDraftPrompts(ctx: ReportDraftPromptContext): {
  system: string;
  user: string;
  temperature: number;
} {
  const system = `You write school report comments for parents (English as a foreign language / similar contexts). 
The student has attended a stand-alone course of short duration. 
The comments are written in a context of how the student has evolved during the short course.
The student will not be returning to any future courses.
Any comments about what the student can do to improve are made in the context of what the student can do for themselves.
The report narrative must be written entirely in ${ctx.langName}. Do not use another language for the main text.
Maximum length 1400 characters. Plain paragraphs only (no markdown headings).
Use only the student's first name (${ctx.studentFirstName}) — do not use or invent a surname.
Base the appraisal on the numerical 0–10 dataset supplied; be fair and specific.`;

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
      ? `Revise or replace this draft (keep facts consistent with the dataset):\n${ctx.existingBody}`
      : "Write a complete comment: opening strength, honest middle where grades are low, end positive with next steps.",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { system, user, temperature: SHORT_COURSE_REPORT_DRAFT_TEMPERATURE };
}
