"use client";

import { CalendarDays, Printer, Save } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { ICON_INLINE } from "@/components/ui/iconSizes";
import type { RomRole } from "@/lib/data/memberships";

type Props = {
  tenantId: string;
  role: RomRole;
  /** Dashboard school workspace: open Timetable panel under the menu instead of leaving the page. */
  onOpenTimetable?: () => void;
};

export function DashboardTimetableSnippet({ tenantId, role, onOpenTimetable }: Props) {
  const { t, lang } = useUiLanguage();
  const base = `/api/tenants/${encodeURIComponent(tenantId)}`;
  const pdfHref = `${base}/timetable-pdf?lang=${encodeURIComponent(lang)}&inline=1`;

  const [rooms, setRooms] = useState("");
  const [am, setAm] = useState("");
  const [pm, setPm] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const isOwner = role === "owner";

  const load = useCallback(async () => {
    if (!isOwner) {
      setLoaded(true);
      return;
    }
    try {
      const res = await fetch(`${base}/timetable`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.settings) {
        const s = data.settings as { room_count: number; periods_am: number; periods_pm: number };
        setRooms(String(s.room_count));
        setAm(String(s.periods_am));
        setPm(String(s.periods_pm));
      }
    } catch {
      /* ignore */
    } finally {
      setLoaded(true);
    }
  }, [base, isOwner]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveLayout() {
    const rc = Number.parseInt(rooms, 10);
    const periodsAm = Number.parseInt(am, 10);
    const periodsPm = Number.parseInt(pm, 10);
    setBusy(true);
    try {
      const res = await fetch(`${base}/timetable`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ room_count: rc, periods_am: periodsAm, periods_pm: periodsPm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || t("common.failed"));
      alert(t("dash.timetableLayoutSaved"));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-emerald-100 bg-white/80 px-3 py-3">
      <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        <CalendarDays className={`${ICON_INLINE} h-3.5 w-3.5 shrink-0 opacity-80`} aria-hidden />
        {t("timetable.title")}
      </div>
      {isOwner && loaded ? (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-[11px] font-medium text-zinc-700">
            {t("dash.timetableRoomsLabel")}
            <input
              type="number"
              min={1}
              max={50}
              className="mt-0.5 w-16 rounded border border-zinc-300 px-1.5 py-1 text-xs"
              value={rooms}
              onChange={(e) => setRooms(e.target.value)}
            />
          </label>
          <label className="flex flex-col text-[11px] font-medium text-zinc-700">
            {t("dash.timetablePeriodsAmLabel")}
            <select className="mt-0.5 rounded border border-zinc-300 px-1.5 py-1 text-xs" value={am} onChange={(e) => setAm(e.target.value)}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-[11px] font-medium text-zinc-700">
            {t("dash.timetablePeriodsPmLabel")}
            <select className="mt-0.5 rounded border border-zinc-300 px-1.5 py-1 text-xs" value={pm} onChange={(e) => setPm(e.target.value)}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveLayout()}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-800 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
          >
            <Save className={`${ICON_INLINE} h-3.5 w-3.5`} aria-hidden />
            {busy ? t("dash.timetableSavingLayout") : t("dash.timetableSaveLayout")}
          </button>
        </div>
      ) : null}
      <div className={`flex flex-wrap gap-2 ${isOwner ? "mt-2" : "mt-1"}`}>
        {onOpenTimetable && (role === "owner" || role === "department_head") ? (
          <button
            type="button"
            onClick={onOpenTimetable}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
          >
            <CalendarDays className={`${ICON_INLINE} h-3.5 w-3.5 opacity-90`} aria-hidden />
            {t("dash.timetable")}
          </button>
        ) : (
          <Link
            href={`/reports/${encodeURIComponent(tenantId)}/timetable`}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
          >
            <CalendarDays className={`${ICON_INLINE} h-3.5 w-3.5 opacity-90`} aria-hidden />
            {role === "teacher" ? t("dash.myTimetable") : t("dash.timetable")}
          </Link>
        )}
        <a
          href={pdfHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 hover:bg-emerald-50/60"
        >
          <Printer className={`${ICON_INLINE} h-3.5 w-3.5 opacity-90`} aria-hidden />
          {role === "teacher" ? t("dash.myTimetablePrint") : t("dash.timetablePrint")}
        </a>
      </div>
    </div>
  );
}
