/**
 * Short-course-only OpenAI prompts (when `report_kind === "short_course"`).
 *
 * Edit this file to change how short-course parent/PDF comments are generated.
 * The standard (term-based) prompts are in `reportCommentPrompts.ts` — copy from there
 * if you want the same scaffolding, then adjust wording and rules.
 */

import type { ReportDraftPromptContext } from "@/lib/ai/reportCommentPrompts";

/** Temperature for short-course draft generation — change if you want stricter/looser wording. */
export const SHORT_COURSE_REPORT_DRAFT_TEMPERATURE = 0.42;

function shortCourseSystemPrompt(ctx: ReportDraftPromptContext): string {
  return `You write one end-of-course comment for parents or guardians after a short standalone course (not part of a three-part school year).

OUTPUT: Entirely in ${ctx.langName}. Max 1400 characters. Plain paragraphs only (no markdown, no headings).
NAME: Use only the first name "${ctx.studentFirstName}". Do not use or invent a surname.
GROUNDING: Base the comment only on the 0–10 rubric supplied; be fair and specific.

MANDATORY CONSTRAINTS — if you break any of these, the output is wrong:
1) Never use the word "term" or any direct equivalent for a school reporting period in any language (e.g. trimester, trimestre, semester, "reporting period", "next marking period", "prochain trimestre"). Talk only about "the course", "this course", or close paraphrases like "this programme" or "during the course".

2) This course is over. Do not imply that the writer will teach this pupil again or that they will meet again. Forbidden patterns include: looking forward to seeing them, see you next…, when we meet again, in our next lesson or class, back in my class, I will work with… next…, we will continue… together, or similar in any language.

3) For any forward-looking encouragement or advice, use only general, non-relationship framing: e.g. going forward, moving forward, in future learning, as they continue to study, ways they might build on what they have learned — without tying the future to this same teacher, class, or any school term structure.`;
}

const SHORT_COURSE_RUBRIC_HINT_EN = `How to read the rubric: This is a finished short course. Higher 0–10 scores generally reflect stronger engagement or development during this course; lower scores reflect areas that were weaker during this course. Comment only on what this single course shows—do not place it inside a longer school year or reporting-cycle story.`;

const SHORT_COURSE_USER_RULES_EN = `Before you write, satisfy every MANDATORY CONSTRAINT in the system message.

Then write the full comment:
• Open with strengths suggested by the data.
• Middle: honest, constructive reflection where scores are lower.
• Close: warm encouragement plus concrete, parent-friendly suggestions phrased with going forward / moving forward / in their future learning — never school "terms", never implying the teacher will see the student again.`;

export function buildShortCourseReportDraftPrompts(ctx: ReportDraftPromptContext): {
  system: string;
  user: string;
  temperature: number;
} {
  const system = shortCourseSystemPrompt(ctx);
  const userParts = [
    `School: ${ctx.schoolName}`,
    ctx.className ? `Class: ${ctx.className}` : "",
    `Student first name (only name to use in text): ${ctx.studentFirstName}`,
    `Subject: ${ctx.subjectLine}`,
    `Short course — interpretation:\n${SHORT_COURSE_RUBRIC_HINT_EN}`,
    `Structured numerical data for this course:\n${ctx.datasetBlock}`,
    ctx.extraNotes
      ? `Teacher background (use only if it fits an end-of-course summary; never use it to imply future lessons with this teacher, future terms, or that you will see the student again):\n${ctx.extraNotes}`
      : "",
    ctx.existingBody
      ? `Revise or replace this draft. Facts must match the rubric. Strip any mention of terms/trimesters/semesters, any school-period timeline, and any suggestion the teacher will meet or teach this pupil again.\n${ctx.existingBody}`
      : SHORT_COURSE_USER_RULES_EN,
  ];
  return {
    system,
    user: userParts.filter(Boolean).join("\n\n"),
    temperature: SHORT_COURSE_REPORT_DRAFT_TEMPERATURE,
  };
}
