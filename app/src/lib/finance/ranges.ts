export type FinanceRange = "day" | "week" | "month" | "year" | "ytd" | "all";

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

export function rangeToUtcBounds(range: FinanceRange, now = new Date()): { from: Date | null; to: Date } {
  const to = now;
  if (range === "all") return { from: null, to };
  if (range === "day") return { from: startOfUtcDay(now), to };
  if (range === "week") {
    // Monday-based week in UTC
    const day = now.getUTCDay(); // 0 = Sun
    const diff = (day + 6) % 7; // 0 for Mon, 6 for Sun
    const monday = startOfUtcDay(new Date(now.getTime() - diff * 24 * 60 * 60 * 1000));
    return { from: monday, to };
  }
  if (range === "month") {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    return { from, to };
  }
  if (range === "year") {
    const from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
    return { from, to };
  }
  // ytd
  const from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
  return { from, to };
}

