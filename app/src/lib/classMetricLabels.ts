/**
 * Single source for grade-area titles on the report form and in the AI dataset block.
 * Per-subject overrides (school-wide) win; otherwise rubric + UI language defaults apply.
 */

import type { GradeRubricProfile } from "@/lib/gradeRubricProfile";
import { metricLabelForRubric } from "@/lib/i18n/gradeRubricLabels";
import type { UiLang } from "@/lib/i18n/uiStrings";
import { isUiLang } from "@/lib/i18n/uiStrings";
import type { ReportLanguageCode } from "@/lib/i18n/reportLanguages";
import { isReportLanguageCode } from "@/lib/i18n/reportLanguages";
import { DATASET4_METRICS, type Dataset4MetricKey } from "@/lib/dataset4Metrics";

export const METRIC_LABEL_MAX_LEN = 80;

export type ClassMetricLabelOverrides = Partial<Record<Dataset4MetricKey, string>>;

/** Last 8 grade rows (skills only) — editable per subject. */
export const SUBJECT_SKILL_METRIC_KEYS = [
  "reading",
  "writing",
  "listening",
  "speaking",
  "pronunciation",
  "grammar",
  "vocabulary",
  "reading_comprehension",
] as const satisfies readonly Dataset4MetricKey[];

export type SubjectSkillMetricKey = (typeof SUBJECT_SKILL_METRIC_KEYS)[number];

export function subjectMetricLabelsStorageKey(storedSubject: string): string {
  const t = storedSubject.trim();
  if (!t) return "";
  const lower = t.toLowerCase();
  if (isSubjectCode(lower)) return lower;
  return lower.replace(/\s+/g, " ").trim();
}

export function pickSkillMetricOverrides(overrides: ClassMetricLabelOverrides): ClassMetricLabelOverrides {
  const out: ClassMetricLabelOverrides = {};
  for (const k of SUBJECT_SKILL_METRIC_KEYS) {
    const v = overrides[k]?.trim();
    if (v) out[k] = v;
  }
  return out;
}

export type MetricLabelsContext = {
  rubric: GradeRubricProfile;
  overrides: ClassMetricLabelOverrides;
  /** Same language as the report grade form (UI locale or teacher preview). */
  displayLang: UiLang;
};

const KEY_SET = new Set<string>(DATASET4_METRICS.map((m) => m.key));

export function isDataset4MetricKey(s: string): s is Dataset4MetricKey {
  return KEY_SET.has(s);
}

export function parseClassMetricLabelOverrides(raw: unknown): ClassMetricLabelOverrides {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ClassMetricLabelOverrides = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isDataset4MetricKey(k) || typeof v !== "string") continue;
    const t = v.trim();
    if (!t) continue;
    out[k] = t.slice(0, METRIC_LABEL_MAX_LEN);
  }
  return pickSkillMetricOverrides(out);
}

export function metricDisplayLangFromReportLanguage(
  code: ReportLanguageCode | string | null | undefined,
  fallback: UiLang,
): UiLang {
  if (code && isReportLanguageCode(code) && isUiLang(code)) return code;
  return fallback;
}

export function buildMetricLabelsContext(
  rubric: GradeRubricProfile,
  overrides: ClassMetricLabelOverrides | null | undefined,
  displayLang: UiLang,
): MetricLabelsContext {
  return {
    rubric,
    overrides: overrides ?? {},
    displayLang,
  };
}

/** Title shown on the report grade grid (and sent to AI for that score line). */
export function resolveMetricLabel(ctx: MetricLabelsContext, key: Dataset4MetricKey): string {
  const custom = ctx.overrides[key]?.trim();
  if (custom) return custom;
  return metricLabelForRubric(ctx.displayLang, key, ctx.rubric);
}

/** Build overrides for save: only skill keys that differ from rubric defaults. */
export function metricLabelOverridesFromSkillDrafts(
  rubric: GradeRubricProfile,
  displayLang: UiLang,
  drafts: Partial<Record<Dataset4MetricKey, string>>,
): ClassMetricLabelOverrides {
  const baseCtx = buildMetricLabelsContext(rubric, {}, displayLang);
  const out: ClassMetricLabelOverrides = {};
  for (const k of SUBJECT_SKILL_METRIC_KEYS) {
    const draft = (drafts[k] ?? "").trim();
    if (!draft) continue;
    const def = resolveMetricLabel(baseCtx, k);
    if (draft !== def) out[k] = draft.slice(0, METRIC_LABEL_MAX_LEN);
  }
  return out;
}

export function defaultSkillMetricLabelDrafts(
  rubric: GradeRubricProfile,
  displayLang: UiLang,
): Record<SubjectSkillMetricKey, string> {
  const ctx = buildMetricLabelsContext(rubric, {}, displayLang);
  const out = {} as Record<SubjectSkillMetricKey, string>;
  for (const k of SUBJECT_SKILL_METRIC_KEYS) out[k] = resolveMetricLabel(ctx, k);
  return out;
}

export function skillMetricLabelDraftsForSubject(
  rubric: GradeRubricProfile,
  displayLang: UiLang,
  overrides: ClassMetricLabelOverrides | null | undefined,
): Record<SubjectSkillMetricKey, string> {
  const ctx = buildMetricLabelsContext(rubric, overrides, displayLang);
  const out = {} as Record<SubjectSkillMetricKey, string>;
  for (const k of SUBJECT_SKILL_METRIC_KEYS) out[k] = resolveMetricLabel(ctx, k);
  return out;
}
