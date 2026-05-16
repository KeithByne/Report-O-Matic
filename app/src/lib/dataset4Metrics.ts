/** Shared definition of the 16 report grade metrics (stable keys + default English titles). */

export const METRIC_DIVISION_KEYS = ["classroom_behaviour", "direct_skills", "indirect_skills"] as const;
export type MetricDivisionKey = (typeof METRIC_DIVISION_KEYS)[number];

export const METRIC_DIVISION_LABEL_EN: Record<MetricDivisionKey, string> = {
  classroom_behaviour: "Classroom behaviour",
  direct_skills: "Direct skills",
  indirect_skills: "Indirect skills",
};

export const DATASET4_METRICS = [
  { key: "attendance", label: "Attendance", divisionKey: "classroom_behaviour" },
  { key: "punctuality", label: "Punctuality", divisionKey: "classroom_behaviour" },
  { key: "completes_homework", label: "Completes homework", divisionKey: "classroom_behaviour" },
  { key: "submits_homework_on_time", label: "Submits homework on time", divisionKey: "classroom_behaviour" },
  { key: "pays_attention_to_teacher", label: "Pays attention to the teacher", divisionKey: "classroom_behaviour" },
  { key: "avoids_distraction", label: "Avoids distraction from classmates", divisionKey: "classroom_behaviour" },
  { key: "takes_part_in_activities", label: "Takes part in classroom activities", divisionKey: "classroom_behaviour" },
  { key: "interacts_with_peers", label: "Interacts well with the other students", divisionKey: "classroom_behaviour" },
  { key: "reading", label: "Reading", divisionKey: "direct_skills" },
  { key: "writing", label: "Writing", divisionKey: "direct_skills" },
  { key: "listening", label: "Listening", divisionKey: "direct_skills" },
  { key: "speaking", label: "Speaking", divisionKey: "direct_skills" },
  { key: "pronunciation", label: "Pronunciation", divisionKey: "indirect_skills" },
  { key: "grammar", label: "Grammar", divisionKey: "indirect_skills" },
  { key: "vocabulary", label: "Vocabulary", divisionKey: "indirect_skills" },
  { key: "reading_comprehension", label: "Reading Comprehension", divisionKey: "indirect_skills" },
] as const;

export type Dataset4MetricKey = (typeof DATASET4_METRICS)[number]["key"];

/** Legacy JSON keys in stored report `inputs.terms` (renamed to match on-screen titles). */
export const LEGACY_METRIC_KEY_BY_CANONICAL: Partial<Record<Dataset4MetricKey, string>> = {
  grammar: "handwriting",
  vocabulary: "audio_comprehension",
};
