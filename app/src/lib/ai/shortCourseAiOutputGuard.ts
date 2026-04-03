/**
 * Short-course AI comments must not mention school calendar slices ("terms", trimesters, etc.).
 * We apply phrase-level replacements, then optionally a repair completion if vocabulary remains.
 */

import OpenAI from "openai";
import type { ReportLanguageCode } from "@/lib/i18n/reportLanguages";
import type { OpenAiUsage } from "@/lib/ai/openaiCost";

/** "Long term" / "short term" are not school periods — ignore those when scanning for forbidden "term". */
function stripLongShortTermPhrases(s: string): string {
  return s.replace(/\b(long|short)[- ]\s*terms?\b/gi, "");
}

type ReplaceRule = { pattern: RegExp; replacement: string };

/** Longer / more specific patterns first. */
const EN_SANITIZE: ReplaceRule[] = [
  { pattern: /\bnext\s+term\b/gi, replacement: "going forward" },
  { pattern: /\beach\s+school\s+terms?\b/gi, replacement: "throughout the course" },
  { pattern: /\bacademic\s+terms?\b/gi, replacement: "the course" },
  { pattern: /\bschool\s+terms?\b/gi, replacement: "the course" },
  { pattern: /\breporting\s+terms?\b/gi, replacement: "this report" },
  { pattern: /\bfirst\s+term\b/gi, replacement: "early in the course" },
  { pattern: /\bsecond\s+term\b/gi, replacement: "mid-course" },
  { pattern: /\bthird\s+term\b/gi, replacement: "later in the course" },
  { pattern: /\blast\s+term\b/gi, replacement: "earlier in the course" },
  { pattern: /\bnext\s+terms\b/gi, replacement: "going forward" },
  { pattern: /\bthis\s+term\b/gi, replacement: "this course" },
  { pattern: /\bthe\s+term\b/gi, replacement: "the course" },
  { pattern: /\beach\s+term\b/gi, replacement: "throughout the course" },
  { pattern: /\bevery\s+term\b/gi, replacement: "throughout the course" },
  { pattern: /\bper\s+term\b/gi, replacement: "for this rubric" },
  { pattern: /\bend\s+of\s+(?:the\s+)?term\b/gi, replacement: "by the end of the course" },
  { pattern: /\bstart\s+of\s+(?:the\s+)?term\b/gi, replacement: "at the start of the course" },
  { pattern: /\bbeginning\s+of\s+(?:the\s+)?term\b/gi, replacement: "at the beginning of the course" },
  { pattern: /\bduring\s+(?:the\s+)?term\b/gi, replacement: "during the course" },
  { pattern: /\bfor\s+(?:the\s+)?term\b/gi, replacement: "for the course" },
  { pattern: /\bover\s+(?:the\s+)?term\b/gi, replacement: "over the course" },
  { pattern: /\bterm\s+time\b/gi, replacement: "course time" },
  { pattern: /\bterm\b['']s\b/gi, replacement: "course's" },
  { pattern: /\bmid[- ]terms?\b/gi, replacement: "mid-course" },
  { pattern: /\bmidterms?\b/gi, replacement: "mid-course" },
  { pattern: /\bterm\s+one\b/gi, replacement: "the first part of the course" },
  { pattern: /\bterm\s+two\b/gi, replacement: "the middle of the course" },
  { pattern: /\bterm\s+three\b/gi, replacement: "the final part of the course" },
  { pattern: /\bterm\s*1\b/gi, replacement: "early in the course" },
  { pattern: /\bterm\s*2\b/gi, replacement: "mid-course" },
  { pattern: /\bterm\s*3\b/gi, replacement: "later in the course" },
  { pattern: /\bterms\s+work\b/gi, replacement: "course work" },
];

const FR_SANITIZE: ReplaceRule[] = [
  { pattern: /\bprochain(?:e)?s?\s+trimestre?s?\b/gi, replacement: "pour la suite" },
  { pattern: /\bce\s+trimestre\b/gi, replacement: "durant ce cours" },
  { pattern: /\ble\s+trimestre\b/gi, replacement: "ce cours" },
  { pattern: /\bpremier\s+trimestre\b/gi, replacement: "le début du cours" },
  { pattern: /\bdeuxi[èe]me\s+trimestre\b/gi, replacement: "le milieu du cours" },
  { pattern: /\btroisi[èe]me\s+trimestre\b/gi, replacement: "la fin du cours" },
  { pattern: /\btrimestre\b/gi, replacement: "cours" },
  { pattern: /\bsemestres?\b/gi, replacement: "cours" },
];

const ES_SANITIZE: ReplaceRule[] = [
  { pattern: /\bpr[oó]ximo\s+trimestre\b/gi, replacement: "de cara al futuro" },
  { pattern: /\beste\s+trimestre\b/gi, replacement: "este curso" },
  { pattern: /\bel\s+trimestre\b/gi, replacement: "el curso" },
  { pattern: /\bprimer\s+trimestre\b/gi, replacement: "el inicio del curso" },
  { pattern: /\bsegundo\s+trimestre\b/gi, replacement: "la parte central del curso" },
  { pattern: /\btercer\s+trimestre\b/gi, replacement: "la parte final del curso" },
  { pattern: /\btrimestres?\b/gi, replacement: "curso" },
  { pattern: /\bsemestres?\b/gi, replacement: "curso" },
];

const DE_SANITIZE: ReplaceRule[] = [
  { pattern: /\bn[äa]chstes\s+Semester\b/gi, replacement: "künftig" },
  { pattern: /\bdieses\s+Semester\b/gi, replacement: "in diesem Kurs" },
  { pattern: /\bim\s+n[äa]chsten\s+Trimester\b/gi, replacement: "künftig" },
  { pattern: /\btrimesters?\b/gi, replacement: "Kurs" },
  { pattern: /\bsemesters?\b/gi, replacement: "Kurs" },
];

const IT_SANITIZE: ReplaceRule[] = [
  { pattern: /\bprossim[oa]\s+trimestre\b/gi, replacement: "in futuro" },
  { pattern: /\bquesto\s+trimestre\b/gi, replacement: "questo corso" },
  { pattern: /\bil\s+trimestre\b/gi, replacement: "il corso" },
  { pattern: /\btrimestri?\b/gi, replacement: "corso" },
  { pattern: /\bsemestri?\b/gi, replacement: "corso" },
];

const PT_SANITIZE: ReplaceRule[] = [
  { pattern: /\bpr[óo]ximo\s+trimestre\b/gi, replacement: "no futuro" },
  { pattern: /\beste\s+trimestre\b/gi, replacement: "este curso" },
  { pattern: /\bo\s+trimestre\b/gi, replacement: "o curso" },
  { pattern: /\btrimestres?\b/gi, replacement: "curso" },
  { pattern: /\bsemestres?\b/gi, replacement: "curso" },
];

const RULES: Record<ReportLanguageCode, ReplaceRule[]> = {
  en: EN_SANITIZE,
  fr: [...FR_SANITIZE, ...EN_SANITIZE],
  es: [...ES_SANITIZE, ...EN_SANITIZE],
  de: [...DE_SANITIZE, ...EN_SANITIZE],
  it: [...IT_SANITIZE, ...EN_SANITIZE],
  pt: [...PT_SANITIZE, ...EN_SANITIZE],
  el: EN_SANITIZE,
  nl: EN_SANITIZE,
  pl: EN_SANITIZE,
  ro: EN_SANITIZE,
  ru: EN_SANITIZE,
  uk: EN_SANITIZE,
  ar: EN_SANITIZE,
};

export function sanitizeShortCourseAiComment(text: string, lang: ReportLanguageCode): string {
  let t = text;
  const rules = RULES[lang] ?? EN_SANITIZE;
  for (const { pattern, replacement } of rules) {
    t = t.replace(pattern, replacement);
  }
  return t;
}

/** True if school-period vocabulary may still be present (after masking allowed "long term" etc.). */
export function shortCourseCommentStillContainsPeriodVocabulary(
  text: string,
  lang: ReportLanguageCode,
): boolean {
  const masked = stripLongShortTermPhrases(text);
  const checks: Partial<Record<ReportLanguageCode, RegExp>> = {
    en: /\bterms?\b/i,
    fr: /\b(trimestre|semestre)s?\b/i,
    es: /\b(trimestre|semestre)s?\b/i,
    de: /\b(trimester|semester)s?\b/i,
    it: /\b(trimestre|semestre)s?\b/i,
    pt: /\b(trimestre|semestre)s?\b/i,
    nl: /\b(trimester|semester)\b/i,
    pl: /\bsemestr\w*\b/i,
    ro: /\b(semestr|trimestr)(e|ul|u)?\b/i,
  };
  if (checks.en?.test(masked)) return true;
  const local = checks[lang];
  if (local && local !== checks.en && local.test(masked)) return true;
  if ((lang === "ru" || lang === "uk" || lang === "ar") && /\bterms?\b/i.test(masked)) return true;
  return false;
}

export async function repairShortCourseCommentRemovingPeriodVocabulary(opts: {
  openai: OpenAI;
  model: string;
  text: string;
  langName: string;
  maxLen: number;
}): Promise<{ text: string; usage: OpenAiUsage | null }> {
  const system = `You are a strict editor. The parent comment describes a SHORT STAND-ALONE COURSE that is finished.
Rewrite the comment entirely in ${opts.langName}.

Hard rules:
- Remove every reference to school calendar divisions: English "term/terms", French trimestre/semestre, Spanish trimestre/semestre, German Trimester/Semester, Italian trimestre/semestre, Portuguese trimestre/semestre, and any close equivalent.
- Use only course-wide wording: the course, this course, during the course, going forward, etc.
- Preserve facts, the student's first name, tone, and approximate length. Plain paragraphs only. No new markdown.

Output only the rewritten comment.`;

  const completion = await opts.openai.chat.completions.create({
    model: opts.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: opts.text },
    ],
    max_tokens: 900,
    temperature: 0.15,
  });
  let out = completion.choices[0]?.message?.content?.trim();
  if (!out) return { text: opts.text, usage: null };
  if (out.length > opts.maxLen) out = out.slice(0, opts.maxLen);
  const usage = completion.usage
    ? {
        model: opts.model,
        prompt_tokens: completion.usage.prompt_tokens ?? 0,
        completion_tokens: completion.usage.completion_tokens ?? 0,
        total_tokens: completion.usage.total_tokens ?? 0,
      }
    : null;
  return { text: out, usage };
}
