/**
 * Short-course-only OpenAI prompts (when `report_kind === "short_course"`).
 * Standard (term-based) prompts: `reportCommentPrompts.ts`.
 */

import type { ReportDraftPromptContext } from "@/lib/ai/reportCommentPrompts";
import {
  homeworkAdviceRestrictionForCefr,
  reportCommentNoLetterClosingRules,
  schoolGradingContextRulesForRubric,
  shortCourseReportDataCompletenessRules,
  shortCourseStandaloneCourseRules,
  teacherPerspectiveVoiceRules,
} from "@/lib/ai/reportCommentPrompts";

/** Matches standard report draft temperature; `max_tokens` stays in `generateReportDraft.ts`. */
export const SHORT_COURSE_REPORT_DRAFT_TEMPERATURE = 0.55;

export function buildShortCourseReportDraftPrompts(ctx: ReportDraftPromptContext): {
  system: string;
  user: string;
  temperature: number;
} {
  const languageSchool = ctx.gradeRubricProfile === "language";
  const cefrBlock = languageSchool ? homeworkAdviceRestrictionForCefr(ctx.classCefrLevel) : "";
  const schoolBlock = schoolGradingContextRulesForRubric(ctx.gradeRubricProfile);
  const dataCompletenessBlock = shortCourseReportDataCompletenessRules();
  const standaloneBlock = shortCourseStandaloneCourseRules();
  const voiceBlock = teacherPerspectiveVoiceRules(ctx.langName);
  const noClosingBlock = reportCommentNoLetterClosingRules();
  const selfImproveLine = cefrBlock
    ? "Frame any improvement suggestions around effort and participation during the course sessions only — not tasks or practice outside scheduled class time, and not preparation for future lessons with us."
    : "Any encouragement about growth should highlight enduring personal strengths shown on the course — not plans for future classes, terms, or contact with us.";
  const opening =
    ctx.gradeRubricProfile === "language"
      ? "You write school report comments for parents (English as a foreign language / similar language-acquisition contexts)."
      : ctx.gradeRubricProfile === "primary"
        ? "You write primary-style short-course report comments for parents about **young learners**; tone and priorities follow the primary school context block below."
        : "You write secondary-style short-course report comments for parents.";
  const system = `${opening}
The student has attended a stand-alone course of short duration — one complete programme, not part of a longer school-year reporting cycle.
${selfImproveLine}
The report narrative must be written entirely in ${ctx.langName}. Do not use another language for the main text.
Maximum length 1400 characters. Plain paragraphs only (no markdown headings).
Use only the student's first name (${ctx.studentFirstName}) — do not use or invent a surname.
Base the appraisal solely on the numerical 0–10 lines supplied; each line is an in-scope topic. Be fair and specific.
${voiceBlock}
${noClosingBlock}
${schoolBlock ? `${schoolBlock}\n` : ""}${standaloneBlock}
${dataCompletenessBlock}
In the comment text itself, never use the English word "term" or calendar labels for school reporting slices (e.g. trimester, trimestre, semester, Schultrimester, "marking period"). Refer only to the course or the programme. Write in ${ctx.langName} without importing phrasing from year-long school reports.${cefrBlock ? `\n${cefrBlock}` : ""}`;

  const user = [
    `School: ${ctx.schoolName}`,
    ctx.className ? `Class: ${ctx.className}` : "",
    `Student first name (only name to use in text): ${ctx.studentFirstName}`,
    `Subject: ${ctx.subjectLine}`,
    `Course rubric data — single 0–10 snapshot for this short course only (standalone; no prior school terms to compare). Your comment must stay in that frame:\n${ctx.datasetBlock}`,
    ctx.extraNotes
      ? `Teacher context (use when shaping the comment for parents; do not quote or label this block; weave in fairly if relevant):\n${ctx.extraNotes}`
      : "",
    ctx.existingBody
      ? `Revise or replace this draft (keep facts consistent with the dataset):\n${ctx.existingBody}`
      : cefrBlock
        ? "Write a complete standalone comment: opening strength, honest middle where grades are low, end with warm ongoing encouragement about qualities shown during the course — no homework or independent study at home, no school-period vocabulary, no future terms/classes/contact with us. Use a first-person teacher voice throughout (see system instructions). Only discuss rubric dimensions that appear as scored lines in the data; do not name or imply any unscored area."
        : "Write a complete standalone comment: opening strength, honest middle where grades are low, end with warm ongoing encouragement about the student's enduring strengths and growth during the course — not future lessons, classes, terms, or contact with us. Use a first-person teacher voice throughout (see system instructions). Only discuss rubric dimensions that appear as scored lines in the data; do not name or imply any unscored area.",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { system, user, temperature: SHORT_COURSE_REPORT_DRAFT_TEMPERATURE };
}
