/**
 * Metric + division labels for general-education rubrics (primary / secondary).
 * Primary: English-only map below. Secondary UI strings live in {@link secondaryRubricMetricI18n}
 * so they are never mixed with language-school {@link REPORT_METRIC_I18N}.
 */

import type { UiLang } from "@/lib/i18n/uiStrings";
import type { GradeRubricProfile } from "@/lib/gradeRubricProfile";
import type { Dataset4MetricKey, MetricDivisionKey } from "@/lib/dataset4Metrics";
import { DATASET4_METRICS, METRIC_DIVISION_LABEL_EN } from "@/lib/dataset4Metrics";
import { metricDivisionLabel, metricLabel } from "@/lib/i18n/uiStrings";
import { secondaryMetricEnglishForAi, secondaryMetricUiLabel } from "@/lib/i18n/secondaryRubricMetricI18n";

/** Primary-style general education metric titles (English; all locales use same for v1). */
const PRIMARY_METRIC_EN: Record<Dataset4MetricKey, string> = {
  attendance: "Attendance",
  punctuality: "Punctuality",
  completes_homework: "Completes assigned work",
  submits_homework_on_time: "Meets deadlines",
  pays_attention_to_teacher: "Focus and engagement in lessons",
  avoids_distraction: "Self-regulation and concentration",
  takes_part_in_activities: "Participation in class activities",
  interacts_with_peers: "Collaboration and positive peer interaction",
  reading: "Interprets information and texts",
  writing: "Written communication of learning",
  listening: "Follows explanations and instructions",
  speaking: "Oral communication and discussion",
  pronunciation: "Overall Progress",
  grammar: "Organisation and presentation of work",
  vocabulary: "Understanding of key concepts",
  reading_comprehension: "Application, reasoning and problem-solving",
};

const PRIMARY_DIV_EN: Record<MetricDivisionKey, string> = {
  classroom_behaviour: "Learning habits",
  direct_skills: "Subject skills",
  indirect_skills: "Understanding and application",
};

const SECONDARY_DIV_EN: Record<MetricDivisionKey, string> = {
  classroom_behaviour: "Learning habits and conduct",
  direct_skills: "Core subject skills",
  indirect_skills: "Depth of learning",
};

export function metricLabelForRubric(lang: UiLang, key: Dataset4MetricKey, rubric: GradeRubricProfile): string {
  switch (rubric) {
    case "language":
      return metricLabel(lang, key);
    case "primary":
      return PRIMARY_METRIC_EN[key];
    case "secondary":
      return secondaryMetricUiLabel(lang, key);
    default: {
      const _exhaustive: never = rubric;
      return _exhaustive;
    }
  }
}

export function metricDivisionLabelForRubric(lang: UiLang, key: MetricDivisionKey, rubric: GradeRubricProfile): string {
  if (rubric === "language") return metricDivisionLabel(lang, key);
  const en = rubric === "primary" ? PRIMARY_DIV_EN[key] : SECONDARY_DIV_EN[key];
  return en;
}

/** English plaintext for AI dataset blocks (matches rubric wording). */
export function metricDivisionHeadingEnForRubric(key: MetricDivisionKey, rubric: GradeRubricProfile): string {
  if (rubric === "language") return METRIC_DIVISION_LABEL_EN[key];
  return rubric === "primary" ? PRIMARY_DIV_EN[key] : SECONDARY_DIV_EN[key];
}

export function metricLineEnForRubric(key: Dataset4MetricKey, rubric: GradeRubricProfile): string {
  switch (rubric) {
    case "language": {
      const m = DATASET4_METRICS.find((x) => x.key === key);
      return m?.label ?? key;
    }
    case "primary":
      return PRIMARY_METRIC_EN[key];
    case "secondary":
      return secondaryMetricEnglishForAi(key);
    default: {
      const _exhaustive: never = rubric;
      return String(_exhaustive);
    }
  }
}
