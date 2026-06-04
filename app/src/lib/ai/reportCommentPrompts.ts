/**
 * Standard (term-based) school report comment prompts sent to OpenAI.
 * Short courses use `shortCourseReportCommentPrompt.ts` by default; subject overrides: `reportCommentPromptRegistry.ts`.
 */

import type { CefrLevel } from "@/lib/classLevel";
import type { GradeRubricProfile } from "@/lib/gradeRubricProfile";
import type { ReportPeriod } from "@/lib/reportInputs";
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
export function standardReportSequentialDataRules(reportPeriod: ReportPeriod): string {
  const termRole =
    reportPeriod === "first"
      ? `This is a **Term 1 (first period)** report for the current scholastic year. Write it as a **standalone** snapshot of progress so far. If no "Prior term grades" block is supplied, do not imply earlier terms in this year or compare to earlier stored reports.`
      : reportPeriod === "second"
        ? `This is a **Term 2 (second period)** report. It must be written **relative to Term 1** when prior saved grades are supplied: comment on improvements, plateaus, or declines you can justify by comparing scored metrics between the prior Term 1 block and the current Term 2 grades. Do not write as if Term 2 were the first report of the year unless prior data is missing.`
        : `This is a **Term 3 (third period)** report — the **last period of the scholastic year**. It must be written **relative to earlier terms in the same scholastic year** when prior saved grades are supplied (Term 1 and/or Term 2 blocks): describe progression across the year using only scored metrics you can compare. Do not write as if it were the first report unless prior data is missing. Follow the year-end and summer-break rules in the dedicated block below.`;

  return `Sequential reporting, prior terms, and incomplete data (mandatory):
- Reports follow calendar order: first term, then second, then third within one scholastic year. ${termRole}
- The block **"Current report — period under review"** holds the grades you are reporting on now. Any **"Prior term grades from other saved reports"** block holds earlier terms from the same scholastic year only — use it for trends and comparison, not as the main appraisal target.
- When prior and current scores differ for the same metric, you may refer to improvement, steady performance, or decline **only** where both scores exist; be fair and specific.
- The structured data lists **only** rubric metrics that have a numeric score. Any skill or behaviour that does **not** appear as a scored line under the relevant term is **out of scope**: do not name it, do not allude to it, and do not invent a score or impression for it.
- Never mention, imply, or invent grades, averages, trends, or qualitative judgments for any metric or term that is not supported by a numeric score in the dataset.
- Do not refer to **later** terms than the period under review. Do not preview or promise outcomes that belong to a future term relative to the focused period.
- Do not reference scholastic years or terms before the prior blocks supplied; prior-year history is out of scope.`;
}

/**
 * Term 3 only: scholastic year is ending; summer break; forward-looking text must target the next period.
 */
export function standardReportThirdPeriodYearEndRules(): string {
  return `Scholastic year ending — Term 3 only (mandatory):
- This is the **final report period of the current scholastic year**. After Term 3, regular lessons with this class and teacher **stop** until the **next scholastic year** begins. There is normally a **summer recess**; school typically resumes around **September** unless teacher notes specify a different calendar.
- You will **not** see this student again in the same class routine until after that break. Do **not** assume lessons continue without interruption, that the same timetable carries on, or that you will pick up where you left off in the near term.
- Any forward-looking wording (next steps, goals, continued learning, encouragement for the future) must refer to the **next course**, **next scholastic year**, **next educational period**, or **new class / programme** — not to ongoing lessons in the current year or imminent sessions with you in the same group.
- Avoid phrasing that implies immediate continuation (e.g. "next week in our lessons", "as we continue this term", "looking forward to seeing you in class soon") unless teacher notes explicitly describe summer teaching or continuity.
- You may wish the student well for the break or the year ahead in a general, parent-appropriate way.`;
}

/** Voice: parents should read this as their child's teacher speaking, not an anonymous report. */
export function teacherPerspectiveVoiceRules(langName: string): string {
  return `Voice and perspective (mandatory):
- Write as the class teacher writing to parents in ${langName}. Use **first person** where natural — singular ("I") and/or plural ("we" for the class or teaching team) as appropriate in ${langName}. The comment should sound like a person who teaches this child, not a distant official bulletin.
- Prefer active, direct phrasing ("I have seen…", "In our lessons…", "I am pleased that…") over heavy passive or impersonal constructions ("It has been observed…", "The student was noted to…", "Attention should be given to…"), which read as third-party or detached. Adapt these examples to natural ${langName}; do not leave them in English if the comment is not English.
- A little passive is acceptable for variety, but do not rely on it as the main voice. Do not write as a neutral narrator or examiner describing the student from outside the classroom.`;
}

/** No letter sign-offs or fill-in lines — the app stores one narrative body only. */
export function reportCommentNoLetterClosingRules(): string {
  return `No letter endings or placeholders (mandatory):
- This text is only the **body** of the report comment for parents. Do **not** add email or letter-style closings (e.g. "Kind regards", "Best wishes", "Sincerely", "Cordialement", "Mit freundlichen Grüßen") or a blank line followed by such a closing.
- Do **not** output lines meant for the teacher to complete later, such as "[Your name]", "[Your position]", "[Name]", "[Title]", "[Signature]", or any bracketed placeholder. Do not invite the user to fill in names or roles after generation.
- End on the last sentence of substantive feedback about the student; nothing after that.`;
}

/** Short-course snapshot: no discussion of missing rubric cells or invented metrics. */
export function shortCourseReportDataCompletenessRules(): string {
  return `Incomplete data (mandatory):
- The rubric block lists **only** metrics that have a numeric score. Any skill or area not shown as a scored line is **out of scope**: do not name it, do not allude to it, and do not discuss it (even vaguely). Do not invent values or imply outcomes that are not in the dataset.
- Comment only on metrics and aggregates that appear with explicit numeric scores in the data block.`;
}

/** Who enters grades / how strands relate — must stay aligned with `GradeRubricProfile`. */
export function schoolGradingContextRulesForRubric(rubric: GradeRubricProfile): string {
  if (rubric === "primary") {
    return `School grading context (primary — mandatory):
- The pupil is a **young primary-aged learner** (roughly early primary through upper primary, depending on year group). Parents must feel you are writing about **a child**, not a secondary pupil or adult. Use **warm, clear, age-appropriate** language; avoid unnecessarily cold, bureaucratic, or examination-board tone where a human, encouraging voice suits a young learner.
- As the class teacher you treat the child’s **healthy development** as a **high priority**: social, emotional, and physical wellbeing **alongside** learning. Where the scored rubric lines reasonably support it, weave in confidence, habits, peer relationships, or wellbeing **without** inventing scores or discussing rubric lines that are absent from the dataset (other rules still forbid that).
- In typical primary settings one class teacher enters holistic feedback across the rubric areas shown in the dataset (one overall classroom programme, not separate specialist teachers per line unless teacher notes say otherwise).
- Write as that class teacher synthesising learning across subjects and attitudes; do not invent multiple subject teachers.`;
  }
  if (rubric === "secondary") {
    return `School grading context (secondary — mandatory):
- Rubric scores may reflect several subject teachers. Keep a coherent class-teacher or form-tutor voice when synthesising, and do not assume one adult taught every scored strand unless teacher notes say so.
- You may acknowledge subject-specific learning where the dataset suggests it, without inventing staff structures.`;
  }
  return "";
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
  /** Numeric rubric plaintext (standard: prior terms + current period; short course: single block). */
  datasetBlock: string;
  extraNotes?: string;
  existingBody?: string;
  /** Same as metric labels in the dataset; drives programme wording and CEFR-only rules. */
  gradeRubricProfile: GradeRubricProfile;
  /** Class CEFR; when A1–B1, prompts forbid advising homework / extra work at home (language schools only). */
  classCefrLevel?: CefrLevel | null;
  /** first | second | third — drives standalone vs comparative prompt rules. */
  reportPeriod: ReportPeriod;
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
  const languageSchool = ctx.gradeRubricProfile === "language";
  const cefrBlock = languageSchool ? homeworkAdviceRestrictionForCefr(ctx.classCefrLevel) : "";
  const schoolBlock = schoolGradingContextRulesForRubric(ctx.gradeRubricProfile);
  const opening =
    ctx.gradeRubricProfile === "language"
      ? "You write school report comments for parents (English as a foreign language / similar language-acquisition contexts)."
      : ctx.gradeRubricProfile === "primary"
        ? "You write primary school report comments for parents about **young learners** in a holistic class programme; tone and priorities follow the primary school context block below."
        : "You write secondary school report comments for parents.";
  const sequentialBlock = standardReportSequentialDataRules(ctx.reportPeriod);
  const yearEndBlock =
    ctx.reportPeriod === "third" ? `\n${standardReportThirdPeriodYearEndRules()}` : "";
  const voiceBlock = teacherPerspectiveVoiceRules(ctx.langName);
  const noClosingBlock = reportCommentNoLetterClosingRules();
  const system = `${opening}
The report narrative must be written entirely in ${ctx.langName}. Do not use another language for the main text.
Maximum length 1400 characters. Plain paragraphs only (no markdown headings).
Use only the student's first name (${ctx.studentFirstName}) — do not use or invent a surname.
Base the appraisal solely on the numerical 0–10 lines supplied; each line is an in-scope topic. Be fair and specific.
${voiceBlock}
${noClosingBlock}
${schoolBlock ? `${schoolBlock}\n` : ""}${sequentialBlock}${yearEndBlock}${cefrBlock ? `\n${cefrBlock}` : ""}`;

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
      ? `Revise or replace this draft (keep facts consistent with the dataset and the sequential-term rules; use prior-term blocks only for fair comparison; do not introduce later terms or missing scores):\n${ctx.existingBody}`
      : cefrBlock
        ? ctx.reportPeriod === "third"
          ? `Write a complete comment for report period "${ctx.reportPeriod}" (final period of the scholastic year). Use a first-person teacher voice. If prior-term saved grades are present, weave in justified progress or trends across the year. Frame any forward-looking sentences for the next course or scholastic year after the summer break — not as if lessons continue soon in this class. Opening strength, honest middle where grades are low, end positive with in-lesson next steps only (no homework), suited to year-end. Use only scored metrics in the dataset.`
          : `Write a complete comment for report period "${ctx.reportPeriod}". Use a first-person teacher voice. If prior-term saved grades are present, weave in justified progress or trends into the current period; if this is the first period and no prior block exists, write standalone. Opening strength, honest middle where grades are low, end positive with in-lesson next steps only (no homework). Use only scored metrics in the dataset.`
        : ctx.reportPeriod === "third"
          ? `Write a complete comment for report period "${ctx.reportPeriod}" (final period of the scholastic year). Use a first-person teacher voice. If prior-term saved grades are present, weave in justified progress or trends across the year. Frame any forward-looking sentences for the next course or scholastic year after the summer break — not as if lessons continue soon in this class. Opening strength, honest middle where grades are low, end positive with next steps suited to year-end. Use only scored metrics in the dataset.`
          : `Write a complete comment for report period "${ctx.reportPeriod}". Use a first-person teacher voice. If prior-term saved grades are present, weave in justified progress or trends into the current period; if this is the first period and no prior block exists, write standalone. Opening strength, honest middle where grades are low, end positive with next steps. Use only scored metrics in the dataset.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { system, user, temperature: STANDARD_REPORT_DRAFT_TEMPERATURE };
}
