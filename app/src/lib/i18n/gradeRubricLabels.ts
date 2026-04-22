/**
 * Metric + division labels for general-education rubrics (primary / secondary).
 * Non-English UI locales fall back to English until full translations are added.
 */

import type { UiLang } from "@/lib/i18n/uiStrings";
import type { GradeRubricProfile } from "@/lib/gradeRubricProfile";
import type { Dataset4MetricKey, MetricDivisionKey } from "@/lib/reportInputs";
import { DATASET4_METRICS, METRIC_DIVISION_LABEL_EN } from "@/lib/reportInputs";
import { metricDivisionLabel, metricLabel } from "@/lib/i18n/uiStrings";

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
  pronunciation: "Accuracy (conventions, notation, terminology)",
  handwriting: "Organisation and presentation of work",
  audio_comprehension: "Understanding of key concepts",
  reading_comprehension: "Application, reasoning and problem-solving",
};

const SECONDARY_METRIC_EN: Record<Dataset4MetricKey, string> = {
  attendance: "Attendance",
  punctuality: "Punctuality",
  completes_homework: "Completes assigned work",
  submits_homework_on_time: "Meets deadlines",
  pays_attention_to_teacher: "Focus and sustained engagement",
  avoids_distraction: "Self-management and study habits",
  takes_part_in_activities: "Participation and contribution in class",
  interacts_with_peers: "Collaboration and respectful interaction",
  reading: "Interprets complex information and sources",
  writing: "Written communication and academic writing",
  listening: "Follows technical explanations and instructions",
  speaking: "Structured oral communication and argument",
  pronunciation: "Accuracy of conventions, notation, and terminology",
  handwriting: "Organisation, structure, and quality of presentation",
  audio_comprehension: "Conceptual understanding",
  reading_comprehension: "Analysis, reasoning, and problem-solving",
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
  if (rubric === "language") return metricLabel(lang, key);
  const en = rubric === "primary" ? PRIMARY_METRIC_EN[key] : SECONDARY_METRIC_EN[key];
  return en;
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
  if (rubric === "language") {
    const m = DATASET4_METRICS.find((x) => x.key === key);
    return m?.label ?? key;
  }
  return rubric === "primary" ? PRIMARY_METRIC_EN[key] : SECONDARY_METRIC_EN[key];
}
