/** Dispatched after class settings are saved (incl. assigned teacher) so timetable and other views refetch. */
export const CLASS_SETTINGS_SAVED_EVENT = "rom:class-settings-saved" as const;

export type ClassSettingsSavedDetail = { tenantId: string };
