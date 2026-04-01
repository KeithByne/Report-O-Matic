/**
 * Subject-specific OpenAI report-comment prompts (optional overrides).
 *
 * - Default builders live in `reportCommentPrompts.ts` (standard) and
 *   `shortCourseReportCommentPrompt.ts` (short course).
 * - Add a row to `SUBJECT_REPORT_PROMPT_OVERRIDES` when a subject needs its own system/user logic.
 * - You can import helpers from a dedicated file per subject, e.g. `reportPrompts/math.ts`.
 */

import type { ReportDraftPromptContext } from "@/lib/ai/reportCommentPrompts";
import { buildStandardReportDraftPrompts } from "@/lib/ai/reportCommentPrompts";
import { buildShortCourseReportDraftPrompts } from "@/lib/ai/shortCourseReportCommentPrompt";
import type { SubjectCode } from "@/lib/subjects";

export type ReportDraftPromptResult = {
  system: string;
  user: string;
  temperature: number;
};

/** Builds system + user + temperature for one generation call. */
export type ReportDraftPromptBuilder = (ctx: ReportDraftPromptContext) => ReportDraftPromptResult;

export type SubjectReportPromptOverrides = {
  /** Term-based / standard report_kind only. Omit to use `buildStandardReportDraftPrompts`. */
  standard?: ReportDraftPromptBuilder;
  /** Short-course report_kind only. Omit to use `buildShortCourseReportDraftPrompts`. */
  shortCourse?: ReportDraftPromptBuilder;
};

/**
 * Per-subject prompt overrides. Keys must be valid `SubjectCode` values from `REPORT_SUBJECTS`.
 *
 * @example
 * ```ts
 * import { buildStandardReportDraftPrompts } from "@/lib/ai/reportCommentPrompts";
 *
 * ffl: {
 *   standard(ctx) {
 *     const base = buildStandardReportDraftPrompts(ctx);
 *     return { ...base, system: base.system + "\\nAdditional French-specific guidance…" };
 *   },
 *   shortCourse: myCustomShortCourseBuilder,
 * },
 * ```
 */
export const SUBJECT_REPORT_PROMPT_OVERRIDES: Partial<Record<SubjectCode, SubjectReportPromptOverrides>> =
  {};

export function resolveStandardReportDraftPrompts(
  subjectCode: SubjectCode,
  ctx: ReportDraftPromptContext,
): ReportDraftPromptResult {
  const builder = SUBJECT_REPORT_PROMPT_OVERRIDES[subjectCode]?.standard ?? buildStandardReportDraftPrompts;
  return builder(ctx);
}

export function resolveShortCourseReportDraftPrompts(
  subjectCode: SubjectCode,
  ctx: ReportDraftPromptContext,
): ReportDraftPromptResult {
  const builder = SUBJECT_REPORT_PROMPT_OVERRIDES[subjectCode]?.shortCourse ?? buildShortCourseReportDraftPrompts;
  return builder(ctx);
}
