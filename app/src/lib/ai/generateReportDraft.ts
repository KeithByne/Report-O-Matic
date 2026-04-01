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

/** Appended to the model prompt for short-course reports only (instructional, English). */
export const SHORT_COURSE_AI_CONTEXT_EN = `The context for this report is that the student has attended a course of short duration. The aim of the report is to suggest the student's evolution over a short time. By this we must recognise that high grades refer to a large or strong evolution over the short course. A notable progress during the course. Whereas a low grade would suggest little progress or a small evolution during the course.`;

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

  const langName = LANGUAGE_INSTRUCTION[opts.outputLanguage] ?? languageLabel(opts.outputLanguage);
  const subjectLine = resolvedSubjectLabel(opts.inputs, opts.classDefaultSubject);
  const datasetBlock = reportInputsToTeacherNotes(opts.inputs, subjectLine);

  const system = `You write school report comments for parents (English as a foreign language / similar contexts). 
The report narrative must be written entirely in ${langName}. Do not use another language for the main text.
Maximum length 1400 characters. Plain paragraphs only (no markdown headings).
Use only the student's first name (${opts.studentFirstName}) — do not use or invent a surname.
Base the appraisal on the numerical 0–10 dataset supplied; be fair and specific.`;

  const user = [
    `School: ${opts.schoolName}`,
    opts.className ? `Class: ${opts.className}` : "",
    `Student first name (only name to use in text): ${opts.studentFirstName}`,
    `Subject: ${subjectLine}`,
    isShortCourseReport(opts.inputs) ? `Short course report — follow this guidance when interpreting the grades:\n${SHORT_COURSE_AI_CONTEXT_EN}` : "",
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

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_tokens: 900,
    temperature: 0.55,
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
