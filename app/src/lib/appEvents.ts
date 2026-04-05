/** Dispatched after class settings are saved (incl. assigned teacher) so timetable and other views refetch. */
export const CLASS_SETTINGS_SAVED_EVENT = "rom:class-settings-saved" as const;

export type ClassSettingsSavedDetail = { tenantId: string };

/** Dispatched after “Generate comment and save data” succeeds so classes term readiness can refetch without a full reload. */
export const REPORT_AI_SAVED_EVENT = "rom:report-ai-saved" as const;

export type ReportAiSavedDetail = { tenantId: string };
