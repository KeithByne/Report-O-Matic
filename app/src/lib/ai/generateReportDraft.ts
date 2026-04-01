import OpenAI from "openai";
import type { ReportLanguageCode } from "@/lib/i18n/reportLanguages";
import { languageLabel } from "@/lib/i18n/reportLanguages";
import type { ReportInputs } from "@/lib/reportInputs";
import { isShortCourseReport, reportInputsToTeacherNotes, resolvedSubjectLabel } from "@/lib/reportInputs";
import type { SubjectCode } from "@/lib/subjects";
import type { OpenAiUsage } from "@/lib/ai/openaiCost";

const LANGUAGE_INSTRUCTION: Record<ReportLanguageCode, string> = {
  en: "British English",
  fr: "French",
  es: "Spanish",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
};

/**
 * Rubric interpretation (English); sent in the user message for short-course generation only.
 * Standard reports use a separate system + user path.
 */
export const SHORT_COURSE_AI_CONTEXT_EN = `How to read the rubric: This is a finished short course. Higher 0–10 scores generally reflect stronger engagement or development during this course; lower scores reflect areas that were weaker during this course. Comment only on what this single course shows—do not place it inside a longer school year or reporting-cycle story.`;

function shortCourseSystemPrompt(studentFirstName: string, langName: string): string {
  return `You write one end-of-course comment for parents or guardians after a short standalone course (not part of a three-part school year).

OUTPUT: Entirely in ${langName}. Max 1400 characters. Plain paragraphs only (no markdown, no headings).
NAME: Use only the first name "${studentFirstName}". Do not use or invent a surname.
GROUNDING: Base the comment only on the 0–10 rubric supplied; be fair and specific.

MANDATORY CONSTRAINTS — if you break any of these, the output is wrong:
1) Never use the word "term" or any direct equivalent for a school reporting period in any language (e.g. trimester, trimestre, semester, "reporting period", "next marking period", "prochain trimestre"). Talk only about "the course", "this course", or close paraphrases like "this programme" or "during the course".

2) This course is over. Do not imply that the writer will teach this pupil again or that they will meet again. Forbidden patterns include: looking forward to seeing them, see you next…, when we meet again, in our next lesson or class, back in my class, I will work with… next…, we will continue… together, or similar in any language.

3) For any forward-looking encouragement or advice, use only general, non-relationship framing: e.g. going forward, moving forward, in future learning, as they continue to study, ways they might build on what they have learned — without tying the future to this same teacher, class, or any school term structure.`;

}

/** User-side checklist for short course (English; model writes the comment in the output language). */
const SHORT_COURSE_USER_RULES_EN = `Before you write, satisfy every MANDATORY CONSTRAINT in the system message.

Then write the full comment:
• Open with strengths suggested by the data.
• Middle: honest, constructive reflection where scores are lower.
• Close: warm encouragement plus concrete, parent-friendly suggestions phrased with going forward / moving forward / in their future learning — never school "terms", never implying the teacher will see the student again.`;

/**
 * Generates report comment text. Per spec: do not send student surname to the model;
 * use first name and numeric dataset only for appraisal.
 */
export async function generateSchoolReportDraft(opts: {
  studentFirstName: string;
  className: string | null;
  schoolName: string;
  outputLanguage: ReportLanguageCode;
  classDefaultSubject: SubjectCode;
  inputs: ReportInputs;
  existingBody?: string;
  extraNotes?: string;
}): Promise<{ text: string; usage: OpenAiUsage | null }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("OPENAI_API_KEY is not set. Add it in Vercel (or .env.local) to use AI drafts.");
  }
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const openai = new OpenAI({ apiKey });

  const shortCourse = isShortCourseReport(opts.inputs);
  const langName = LANGUAGE_INSTRUCTION[opts.outputLanguage] ?? languageLabel(opts.outputLanguage);
  const subjectLine = resolvedSubjectLabel(opts.inputs, opts.classDefaultSubject);
  const datasetBlock = reportInputsToTeacherNotes(opts.inputs, subjectLine);

  let system: string;
  let user: string;
  let temperature: number;

  if (shortCourse) {
    system = shortCourseSystemPrompt(opts.studentFirstName, langName);
    const userParts = [
      `School: ${opts.schoolName}`,
      opts.className ? `Class: ${opts.className}` : "",
      `Student first name (only name to use in text): ${opts.studentFirstName}`,
      `Subject: ${subjectLine}`,
      `Short course — interpretation:\n${SHORT_COURSE_AI_CONTEXT_EN}`,
      `Structured numerical data for this course:\n${datasetBlock}`,
      opts.extraNotes
        ? `Teacher background (use only if it fits an end-of-course summary; never use it to imply future lessons with this teacher, future terms, or that you will see the student again):\n${opts.extraNotes}`
        : "",
      opts.existingBody
        ? `Revise or replace this draft. Facts must match the rubric. Strip any mention of terms/trimesters/semesters, any school-period timeline, and any suggestion the teacher will meet or teach this pupil again.\n${opts.existingBody}`
        : SHORT_COURSE_USER_RULES_EN,
    ];
    user = userParts.filter(Boolean).join("\n\n");
    temperature = 0.42;
  } else {
    system = `You write school report comments for parents (English as a foreign language / similar contexts). 
The report narrative must be written entirely in ${langName}. Do not use another language for the main text.
Maximum length 1400 characters. Plain paragraphs only (no markdown headings).
Use only the student's first name (${opts.studentFirstName}) — do not use or invent a surname.
Base the appraisal on the numerical 0–10 dataset supplied; be fair and specific.`;
    user = [
      `School: ${opts.schoolName}`,
      opts.className ? `Class: ${opts.className}` : "",
      `Student first name (only name to use in text): ${opts.studentFirstName}`,
      `Subject: ${subjectLine}`,
      `Structured numerical data and term labels:\n${datasetBlock}`,
      opts.extraNotes
        ? `Teacher context (use when shaping the comment for parents; do not quote or label this block; weave in fairly if relevant):\n${opts.extraNotes}`
        : "",
      opts.existingBody
        ? `Revise or replace this draft (keep facts consistent with the dataset):\n${opts.existingBody}`
        : "Write a complete comment: opening strength, honest middle where grades are low, end positive with next steps.",
    ]
      .filter(Boolean)
      .join("\n\n");
    temperature = 0.55;
  }

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_tokens: 900,
    temperature,
  });
  let text = completion.choices[0]?.message?.content?.trim();
  if (!text) throw new Error("The model returned no text.");
  if (text.length > 1400) text = text.slice(0, 1400);
  const usage = completion.usage
    ? {
        model,
        prompt_tokens: completion.usage.prompt_tokens ?? 0,
        completion_tokens: completion.usage.completion_tokens ?? 0,
        total_tokens: completion.usage.total_tokens ?? 0,
      }
    : null;
  return { text, usage };
}

/**
 * Faithful translation of the parent/PDF comment into the teacher preview language.
 * The PDF text is canonical; this must preserve meaning and tone.
 */
export async function translateReportComment(opts: {
  text: string;
  fromLanguage: ReportLanguageCode;
  toLanguage: ReportLanguageCode;
}): Promise<{ text: string; usage: OpenAiUsage | null }> {
  const t = opts.text.trim();
  if (!t) return { text: "", usage: null };
  if (opts.fromLanguage === opts.toLanguage) return { text: t, usage: null };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("OPENAI_API_KEY is not set. Add it in Vercel (or .env.local) to use AI drafts.");
  }
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const openai = new OpenAI({ apiKey });

  const fromName = LANGUAGE_INSTRUCTION[opts.fromLanguage] ?? languageLabel(opts.fromLanguage);
  const toName = LANGUAGE_INSTRUCTION[opts.toLanguage] ?? languageLabel(opts.toLanguage);

  const system = `You are a professional translator for school report comments.
Translate the entire comment faithfully from ${fromName} into ${toName}.
Preserve meaning, tone, and structure. Do not add facts or change the appraisal.
Maximum length 1400 characters. Plain paragraphs only (no markdown).`;

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: t },
    ],
    max_tokens: 900,
    temperature: 0.2,
  });
  let out = completion.choices[0]?.message?.content?.trim();
  if (!out) throw new Error("The model returned no translation.");
  if (out.length > 1400) out = out.slice(0, 1400);
  const usage = completion.usage
    ? {
        model,
        prompt_tokens: completion.usage.prompt_tokens ?? 0,
        completion_tokens: completion.usage.completion_tokens ?? 0,
        total_tokens: completion.usage.total_tokens ?? 0,
      }
    : null;
  return { text: out, usage };
}

/** Generate once in PDF/parent language, then translate to teacher preview language (equivalent meaning). */
export async function generateSchoolReportDraftPair(opts: {
  studentFirstName: string;
  className: string | null;
  schoolName: string;
  pdfLanguage: ReportLanguageCode;
  teacherLanguage: ReportLanguageCode;
  classDefaultSubject: SubjectCode;
  inputs: ReportInputs;
  extraNotes?: string;
}): Promise<{
  pdfBody: string;
  teacherPreview: string;
  usage: { draft: OpenAiUsage | null; translate: OpenAiUsage | null };
}> {
  const common = {
    studentFirstName: opts.studentFirstName,
    className: opts.className,
    schoolName: opts.schoolName,
    classDefaultSubject: opts.classDefaultSubject,
    inputs: opts.inputs,
    extraNotes: opts.extraNotes,
  };
  const draft = await generateSchoolReportDraft({
    ...common,
    outputLanguage: opts.pdfLanguage,
    existingBody: undefined,
  });
  const pdfBody = draft.text;
  let teacherPreview: string;
  let translateUsage: OpenAiUsage | null = null;
  if (opts.pdfLanguage === opts.teacherLanguage) {
    teacherPreview = pdfBody;
  } else {
    const translated = await translateReportComment({
      text: pdfBody,
      fromLanguage: opts.pdfLanguage,
      toLanguage: opts.teacherLanguage,
    });
    teacherPreview = translated.text;
    translateUsage = translated.usage;
  }
  return { pdfBody, teacherPreview, usage: { draft: draft.usage, translate: translateUsage } };
}
