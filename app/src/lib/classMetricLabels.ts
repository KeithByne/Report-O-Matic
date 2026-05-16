/**
 * Single source for grade-area titles on the report form and in the AI dataset block.
 * Class-level overrides win; otherwise rubric + UI language defaults apply.
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
  return out;
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

/** Build overrides JSON for PATCH: only keys that differ from defaults for this class. */
export function metricLabelOverridesFromDrafts(
  rubric: GradeRubricProfile,
  displayLang: UiLang,
  drafts: Partial<Record<Dataset4MetricKey, string>>,
): ClassMetricLabelOverrides {
  const baseCtx = buildMetricLabelsContext(rubric, {}, displayLang);
  const out: ClassMetricLabelOverrides = {};
  for (const m of DATASET4_METRICS) {
    const draft = (drafts[m.key] ?? "").trim();
    if (!draft) continue;
    const def = resolveMetricLabel(baseCtx, m.key);
    if (draft !== def) out[m.key] = draft.slice(0, METRIC_LABEL_MAX_LEN);
  }
  return out;
}

/** Default titles for class settings (no overrides). */
export function defaultMetricLabelDrafts(rubric: GradeRubricProfile, displayLang: UiLang): Record<Dataset4MetricKey, string> {
  const ctx = buildMetricLabelsContext(rubric, {}, displayLang);
  const out = {} as Record<Dataset4MetricKey, string>;
  for (const m of DATASET4_METRICS) out[m.key] = resolveMetricLabel(ctx, m.key);
  return out;
}

/** Merge stored overrides onto defaults for editing. */
export function metricLabelDraftsForClass(
  rubric: GradeRubricProfile,
  displayLang: UiLang,
  overrides: ClassMetricLabelOverrides | null | undefined,
): Record<Dataset4MetricKey, string> {
  const ctx = buildMetricLabelsContext(rubric, overrides, displayLang);
  const out = {} as Record<Dataset4MetricKey, string>;
  for (const m of DATASET4_METRICS) out[m.key] = resolveMetricLabel(ctx, m.key);
  return out;
}
