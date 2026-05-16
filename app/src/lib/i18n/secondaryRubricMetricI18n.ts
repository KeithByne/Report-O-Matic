/**
 * Secondary-school rubric metric titles for the **UI only** (and English plaintext for AI).
 *
 * This table is intentionally **not** shared with {@link REPORT_METRIC_I18N} (language acquisition)
 * or primary rubric strings — do not merge or fall back across school modes.
 *
 * Today every `UiLang` maps to the same English string so the UI can switch locales without
 * accidentally pulling language-school labels. Add per-locale overrides in
 * `SECONDARY_METRIC_UI_OVERRIDES` when translations are ready.
 */

import type { Dataset4MetricKey } from "@/lib/dataset4Metrics";
import { UI_LOCALE_CODES } from "@/lib/i18n/reportLanguages";
import type { UiLang } from "@/lib/i18n/uiStrings";

/** Canonical English for each secondary rubric row (single source of truth). */
export const SECONDARY_METRIC_EN_BY_KEY: Record<Dataset4MetricKey, string> = {
  attendance: "Subject knowledge – understanding of key content and concepts",
  punctuality: "Application of knowledge – using what's learned in tasks, problems, or new contexts",
  completes_homework: "Analysis – breaking down information and explaining ideas",
  submits_homework_on_time: "Accuracy – correctness in answers, language, or methods",
  pays_attention_to_teacher: "Quality of work – overall standard of classwork and assignments",
  avoids_distraction: "Progress – improvement over the term or year",
  takes_part_in_activities: "Effort – level of commitment and work ethic",
  interacts_with_peers: "Homework – completion, punctuality, and standard",
  reading: "Class participation – engagement in lessons and discussions",
  writing: "Organization – keeping notes, materials, and deadlines in order",
  listening: "Independence – ability to work without constant guidance",
  speaking: "Response to feedback – acting on corrections and advice",
  pronunciation: "Exam / test performance – results under assessment conditions",
  grammar: "Presentation – clarity and neatness of written or practical work",
  vocabulary: "Critical thinking – ability to think deeply, question, and form reasoned ideas",
  reading_comprehension: "Overall Progress – the student's quantifiable progress during the course",
};

/**
 * Optional per-locale overrides for secondary metrics only.
 * Keys: locale → metric key → translated string. Unlisted metrics fall back to English in
 * {@link SECONDARY_METRIC_EN_BY_KEY}.
 */
export const SECONDARY_METRIC_UI_OVERRIDES: Partial<Record<UiLang, Partial<Record<Dataset4MetricKey, string>>>> = {};

function buildSecondaryMetricUiTable(): Record<Dataset4MetricKey, Record<UiLang, string>> {
  const out = {} as Record<Dataset4MetricKey, Record<UiLang, string>>;
  (Object.keys(SECONDARY_METRIC_EN_BY_KEY) as Dataset4MetricKey[]).forEach((key) => {
    const en = SECONDARY_METRIC_EN_BY_KEY[key];
    const row = {} as Record<UiLang, string>;
    for (const code of UI_LOCALE_CODES) {
      const lang = code as UiLang;
      const o = SECONDARY_METRIC_UI_OVERRIDES[lang]?.[key]?.trim();
      row[lang] = o && o.length > 0 ? o : en;
    }
    out[key] = row;
  });
  return out;
}

const SECONDARY_RUBRIC_METRIC_UI: Record<Dataset4MetricKey, Record<UiLang, string>> = buildSecondaryMetricUiTable();

/** UI label for one secondary rubric row; never reads language-school or primary tables. */
export function secondaryMetricUiLabel(lang: UiLang, key: Dataset4MetricKey): string {
  return SECONDARY_RUBRIC_METRIC_UI[key][lang];
}

/** English line for AI / PDF plaintext when rubric is secondary. */
export function secondaryMetricEnglishForAi(key: Dataset4MetricKey): string {
  return SECONDARY_METRIC_EN_BY_KEY[key];
}
