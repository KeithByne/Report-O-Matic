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
  const system = `You write school report comments for parents (English as a foreign language / similar contexts). 
The report narrative must be written entirely in ${ctx.langName}. Do not use another language for the main text.
Maximum length 1400 characters. Plain paragraphs only (no markdown headings).
Use only the student's first name (${ctx.studentFirstName}) — do not use or invent a surname.
Base the appraisal on the numerical 0–10 dataset supplied; be fair and specific.${cefrBlock ? `\n${cefrBlock}` : ""}`;

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
      : cefrBlock
        ? "Write a complete comment: opening strength, honest middle where grades are low, end positive with in-lesson next steps only (no homework or independent work at home)."
        : "Write a complete comment: opening strength, honest middle where grades are low, end positive with next steps.",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { system, user, temperature: STANDARD_REPORT_DRAFT_TEMPERATURE };
}
