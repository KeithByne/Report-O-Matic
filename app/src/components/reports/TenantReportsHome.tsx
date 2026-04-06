"use client";

import {
  BookOpen,
  CalendarDays,
  Download,
  FolderKanban,
  Languages,
  LayoutList,
  Sparkles,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { classesListHref } from "@/lib/app/classesNavigation";
import { TimetablePageClient } from "@/components/timetable/TimetablePageClient";
import { ICON_INLINE, ICON_SECTION } from "@/components/ui/iconSizes";
import { CLASS_SETTINGS_SAVED_EVENT, type ClassSettingsSavedDetail } from "@/lib/appEvents";
import { reportLanguageOptionLabel } from "@/lib/i18n/uiStrings";
import type { RomRole } from "@/lib/data/memberships";
import { REPORT_LANGUAGES, type ReportLanguageCode } from "@/lib/i18n/reportLanguages";

export type TenantPanelId = "welcome" | "timetable" | "language" | "bulk" | "classes";

type Props = {
  tenantId: string;
  schoolName: string;
  viewerRole: RomRole;
  /** From `?panel=` on first load — opens matching section(s). Use `classes`, `timetable`, `language`, `bulk`, `welcome`. */
  bootPanels?: TenantPanelId[];
};

const PANEL_ICON: Record<TenantPanelId, LucideIcon> = {
  welcome: LayoutList,
  language: Languages,
  classes: BookOpen,
  bulk: Download,
  timetable: CalendarDays,
};

export function TenantReportsHome({ tenantId, schoolName, viewerRole, bootPanels }: Props) {
  const { t, lang: uiLang } = useUiLanguage();
  const router = useRouter();
  const [lang, setLang] = useState<ReportLanguageCode>("en");
  const [teacherOnlyFinal, setTeacherOnlyFinal] = useState(false);
  const [bulkGroupBy, setBulkGroupBy] = useState<"term" | "teacher" | "class" | "student">("term");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [openPanels, setOpenPanels] = useState<Set<TenantPanelId>>(() => new Set());

  const base = `/api/tenants/${encodeURIComponent(tenantId)}`;

  const togglePanel = useCallback((id: TenantPanelId) => {
    setOpenPanels((prev) => {
      if (prev.has(id) && prev.size === 1) return new Set();
      return new Set([id]);
    });
  }, []);

  const panelButtonClass = useCallback(
    (id: TenantPanelId) =>
      openPanels.has(id)
        ? "border-emerald-600 bg-emerald-100 text-emerald-950"
        : "border-emerald-200 bg-white text-zinc-700 hover:bg-emerald-50/80",
    [openPanels],
  );

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const sRes = await fetch(`${base}/settings`);
      const sData = await sRes.json().catch(() => ({}));
      if (!sRes.ok) throw new Error(sData.error || t("tenant.errLoadSettings"));
      if (typeof sData.default_report_language === "string") {
        const code = sData.default_report_language as ReportLanguageCode;
        if (REPORT_LANGUAGES.some((x) => x.code === code)) setLang(code);
      }
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : t("common.loadFailed"));
    }
  }, [base, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onClassSettingsSaved = (ev: Event) => {
      const ce = ev as CustomEvent<ClassSettingsSavedDetail>;
      const id = ce.detail?.tenantId?.trim();
      if (id && id === tenantId) void refresh();
    };
    window.addEventListener(CLASS_SETTINGS_SAVED_EVENT, onClassSettingsSaved);
    return () => window.removeEventListener(CLASS_SETTINGS_SAVED_EVENT, onClassSettingsSaved);
  }, [tenantId, refresh]);

  useEffect(() => {
    if (!bootPanels?.length) return;
    const lead = viewerRole === "owner" || viewerRole === "department_head";
    const allowed = bootPanels.filter((panelId) => panelId !== "bulk" || lead);
    if (!allowed.length) return;
    const last = allowed[allowed.length - 1];
    if (last === "classes") {
      router.push(classesListHref(tenantId, viewerRole));
      return;
    }
    setOpenPanels(new Set([last]));
  }, [bootPanels, viewerRole, tenantId, router]);

  async function saveLanguage(next: ReportLanguageCode) {
    setLang(next);
    setBusy("lang");
    try {
      const res = await fetch(`${base}/settings`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ default_report_language: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("tenant.errSaveSettings"));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setBusy(null);
    }
  }

  const isLead = viewerRole === "owner" || viewerRole === "department_head";
  const teacherBatchHref = useMemo(() => {
    const qp = new URLSearchParams();
    if (teacherOnlyFinal) qp.set("onlyFinal", "1");
    qp.set("order", bulkGroupBy);
    return `${base}/reports/pdf-batch?${qp.toString()}`;
  }, [base, bulkGroupBy, teacherOnlyFinal]);

  const menuItems = useMemo(() => {
    const items: { id: TenantPanelId; label: string; Icon: LucideIcon }[] = [
      { id: "welcome", label: t("dash.panelOverview"), Icon: PANEL_ICON.welcome },
      { id: "language", label: t("tenant.panelLanguage"), Icon: PANEL_ICON.language },
      { id: "classes", label: t("tenant.panelClasses"), Icon: PANEL_ICON.classes },
      { id: "timetable", label: t("tenant.panelTimetable"), Icon: PANEL_ICON.timetable },
    ];
    if (isLead) items.push({ id: "bulk", label: t("tenant.panelDownloads"), Icon: PANEL_ICON.bulk });
    return items;
  }, [isLead, t]);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
          <FolderKanban className={ICON_SECTION} aria-hidden />
          {t("tenant.sectionMenuTitle")}
        </h2>
        <p className="mt-1 text-sm text-zinc-600">{t("tenant.sectionMenuHint")}</p>
        <nav className="mt-4 flex flex-wrap gap-2" aria-label={t("tenant.sectionMenuTitle")}>
          {menuItems.map(({ id, label, Icon }) =>
            id === "classes" ? (
              <Link
                key={id}
                href={classesListHref(tenantId, viewerRole)}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-emerald-50/80"
              >
                <Icon className={ICON_INLINE} aria-hidden />
                {label}
              </Link>
            ) : (
              <button
                key={id}
                type="button"
                onClick={() => togglePanel(id)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${panelButtonClass(id)}`}
              >
                <Icon className={ICON_INLINE} aria-hidden />
                {label}
              </button>
            ),
          )}
          {isLead ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-emerald-50/80"
            >
              <UserPlus className={ICON_INLINE} aria-hidden />
              {t("dash.panelInviteTeam")}
            </Link>
          ) : null}
        </nav>
      </section>

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{loadError}</div>
      ) : null}

      {openPanels.has("welcome") ? (
        <>
          {viewerRole === "owner" ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-950">
              <p className="flex items-center gap-2 font-semibold text-emerald-900">
                <Sparkles className={ICON_SECTION} aria-hidden />
                {t("tenant.ownerBannerTitle")}
              </p>
              <p className="mt-2 text-emerald-900/90">{t("tenant.ownerBannerBody", { school: schoolName })}</p>
            </div>
          ) : viewerRole === "department_head" ? (
            <div className="rounded-2xl border border-teal-200 bg-teal-50/80 p-4 text-sm text-teal-950">
              <p className="flex items-center gap-2 font-semibold text-teal-900">
                <Sparkles className={ICON_SECTION} aria-hidden />
                {t("tenant.dhBannerTitle")}
              </p>
              <p className="mt-2 text-teal-900/90">{t("tenant.dhBannerBody", { school: schoolName })}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-green-200 bg-green-50/80 p-4 text-sm text-green-950">
              <p className="flex items-center gap-2 font-semibold text-green-900">
                <Sparkles className={ICON_SECTION} aria-hidden />
                {t("tenant.teacherBannerTitle")}
              </p>
              <p className="mt-2 text-green-900/90">{t("tenant.teacherBannerBody")}</p>
            </div>
          )}
        </>
      ) : null}

      {openPanels.has("timetable") ? (
        <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <CalendarDays className={ICON_SECTION} aria-hidden />
            {t("timetable.title")}
          </h2>
          <TimetablePageClient tenantId={tenantId} schoolName={schoolName} viewerRole={viewerRole} embedded />
        </div>
      ) : null}

      {openPanels.has("language") ? (
        <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <Languages className={ICON_SECTION} aria-hidden />
            {t("tenant.schoolLangTitle")}
          </h2>
          <p className="mt-1 text-xs text-zinc-500">{isLead ? t("tenant.schoolLangLead") : t("tenant.schoolLangReadonly")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <select
              value={lang}
              onChange={(e) => void saveLanguage(e.target.value as ReportLanguageCode)}
              disabled={busy !== null || !isLead}
              className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-emerald-50 disabled:text-zinc-600"
            >
              {REPORT_LANGUAGES.map((o) => (
                <option key={o.code} value={o.code}>
                  {reportLanguageOptionLabel(uiLang, o.code)}
                </option>
              ))}
            </select>
            {busy === "lang" ? <span className="text-xs text-zinc-500">{t("tenant.saving")}</span> : null}
          </div>
        </section>
      ) : null}

      {openPanels.has("bulk") && isLead ? (
        <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <Download className={ICON_SECTION} aria-hidden />
            {t("tenant.bulkDownloadsTitle")}
          </h2>
          <p className="mt-1 text-xs text-zinc-500">{t("tenant.bulkDownloadsLead")}</p>
          <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-3">
            <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={teacherOnlyFinal}
                onChange={(e) => setTeacherOnlyFinal(e.target.checked)}
                className="h-4 w-4"
              />
              {t("tenant.finalOnly")}
            </label>
            <div className="flex w-full flex-wrap items-end justify-end gap-x-4 gap-y-2 sm:ml-auto sm:w-auto">
              <label className="flex items-center gap-[2ch] text-sm">
                <span className="shrink-0 text-zinc-600">{t("tenant.bulkGroupByLabel")}</span>
                <select
                  value={bulkGroupBy}
                  onChange={(e) => setBulkGroupBy(e.target.value as typeof bulkGroupBy)}
                  className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="term">{t("tenant.bulkGroupTerm")}</option>
                  <option value="teacher">{t("tenant.bulkGroupTeacher")}</option>
                  <option value="class">{t("tenant.bulkGroupClass")}</option>
                  <option value="student">{t("tenant.bulkGroupStudent")}</option>
                </select>
              </label>
              <a
                href={teacherBatchHref}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-emerald-100"
              >
                <Download className={ICON_INLINE} aria-hidden />
                {t("tenant.downloadBulkPdfsOneFile")}
              </a>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
