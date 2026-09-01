export type TimetableDisplayDensity = "comfortable" | "compact";

export const DEFAULT_TIMETABLE_OVERVIEW_ROOMS_PER_PAGE = 5;

export const TIMETABLE_OVERVIEW_ROOMS_PER_PAGE_OPTIONS = [1, 2, 3, 5, 10] as const;

export function parseOverviewRoomsPerPage(raw: unknown): number {
  const n = typeof raw === "number" ? Math.floor(raw) : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n)) return DEFAULT_TIMETABLE_OVERVIEW_ROOMS_PER_PAGE;
  return Math.max(1, Math.min(10, n));
}

export function parseTimetableDisplayDensity(raw: unknown): TimetableDisplayDensity {
  return raw === "compact" ? "compact" : "comfortable";
}

export function timetableGridRowHeights(density: TimetableDisplayDensity): {
  overviewRoomRowPx: number;
  singleSlotMinPx: number;
  lunchMinPx: number;
  emptySlotMinPx: number;
} {
  if (density === "compact") {
    return { overviewRoomRowPx: 40, singleSlotMinPx: 88, lunchMinPx: 88, emptySlotMinPx: 72 };
  }
  return { overviewRoomRowPx: 56, singleSlotMinPx: 120, lunchMinPx: 120, emptySlotMinPx: 100 };
}
