import OpenAI from "openai";
import type { ReportLanguageCode } from "@/lib/i18n/reportLanguages";
import { languageLabel } from "@/lib/i18n/reportLanguages";
import type { ReportInputs } from "@/lib/reportInputs";
import { isShortCourseReport, reportInputsToTeacherNotes, resolvedSubjectLabel } from "@/lib/reportInputs";
import type { SubjectCode } from "@/lib/subjects";
import type { OpenAiUsage } from "@/lib/ai/openaiCost";
import { buildStandardReportDraftPrompts } from "@/lib/ai/reportCommentPrompts";
import { buildShortCourseReportDraftPrompts } from "@/lib/ai/shortCourseReportCommentPrompt";

const LANGUAGE_INSTRUCTION: Record<ReportLanguageCode, string> = {
  en: "British English",
  fr: "French",
  es: "Spanish",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
};

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

  const ctx = {
    langName,
    studentFirstName: opts.studentFirstName,
    schoolName: opts.schoolName,
    className: opts.className,
    subjectLine,
    datasetBlock,
    extraNotes: opts.extraNotes,
    existingBody: opts.existingBody,
  };

  const { system, user, temperature } = isShortCourseReport(opts.inputs)
    ? buildShortCourseReportDraftPrompts(ctx)
    : buildStandardReportDraftPrompts(ctx);

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
