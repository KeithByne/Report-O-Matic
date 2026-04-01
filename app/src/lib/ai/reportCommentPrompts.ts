/**
 * Standard (term-based) school report comment prompts sent to OpenAI.
 * Short courses use `shortCourseReportCommentPrompt.ts` instead.
 */

export type ReportDraftPromptContext = {
  /** e.g. "British English", "French" — from LANGUAGE_INSTRUCTION / languageLabel */
  langName: string;
  studentFirstName: string;
  schoolName: string;
  className: string | null;
  subjectLine: string;
  /** From reportInputsToTeacherNotes (includes term labels for standard reports). */
  datasetBlock: string;
  extraNotes?: string;
  existingBody?: string;
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
  const system = `You write school report comments for parents (English as a foreign language / similar contexts). 
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

  return { system, user, temperature: STANDARD_REPORT_DRAFT_TEMPERATURE };
}
