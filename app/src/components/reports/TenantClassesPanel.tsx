"use client";

import { BookOpen, DoorOpen, Plus, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { ICON_INLINE, ICON_SECTION } from "@/components/ui/iconSizes";
import { CLASS_SETTINGS_SAVED_EVENT, type ClassSettingsSavedDetail } from "@/lib/appEvents";
import type { RomRole } from "@/lib/data/memberships";

type ClassRow = { id: string; name: string; student_count: number };

type TermCompletion = { first: boolean; second: boolean; third: boolean };

export type TenantClassesPanelProps = {
  tenantId: string;
  viewerRole: RomRole;
  /** When true (panel visible), class list and term readiness are loaded; refetch each time this becomes true. */
  active: boolean;
};

function TermReadiness({ terms }: { terms: TermCompletion | undefined }) {
  const cls = (ok: boolean | undefined) =>
    ok === undefined ? "text-zinc-400" : ok ? "text-emerald-600" : "text-red-600";
  return (
    <span className="inline-flex items-center font-mono text-sm tabular-nums">
      <span className={cls(terms?.first)}>1</span>
      <span className="text-zinc-900">/</span>
      <span className={cls(terms?.second)}>2</span>
      <span className="text-zinc-900">/</span>
      <span className={cls(terms?.third)}>3</span>
    </span>
  );
}

/**
 * Single school “Classes” card: list, term readiness, bulk PDF by term, add/delete (leads), open class + students links.
 * Used on `/reports/[tenant]?panel=classes` and on the dashboard workspace — same behaviour everywhere.
 */
export function TenantClassesPanel({ tenantId, viewerRole, active }: TenantClassesPanelProps) {
  const { t } = useUiLanguage();
  const router = useRouter();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [termByClass, setTermByClass] = useState<Record<string, TermCompletion>>({});
  const [newClassName, setNewClassName] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [bulkTerm, setBulkTerm] = useState<"first" | "second" | "third">("first");

  const base = `/api/tenants/${encodeURIComponent(tenantId)}`;
  const isLead = viewerRole === "owner" || viewerRole === "department_head";
  const bulkHref = `${base}/reports/pdf-batch?term=${bulkTerm}`;

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const [resClasses, resTerms] = await Promise.all([
        fetch(`${base}/classes`),
        fetch(`${base}/classes/term-completion`),
      ]);
      const dataC = await resClasses.json().catch(() => ({}));
      if (!resClasses.ok) throw new Error(dataC.error || "Failed to load classes");
      setClasses(dataC.classes ?? []);
      const dataT = await resTerms.json().catch(() => ({}));
      if (resTerms.ok) setTermByClass(dataT.byClassId ?? {});
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : "Load failed");
    }
  }, [base]);

  useEffect(() => {
    if (!active) return;
    void refresh();
  }, [active, refresh]);

  useEffect(() => {
    const onClassSettingsSaved = (ev: Event) => {
      const ce = ev as CustomEvent<ClassSettingsSavedDetail>;
      const id = ce.detail?.tenantId?.trim();
      if (id && id === tenantId && active) void refresh();
    };
    window.addEventListener(CLASS_SETTINGS_SAVED_EVENT, onClassSettingsSaved);
    return () => window.removeEventListener(CLASS_SETTINGS_SAVED_EVENT, onClassSettingsSaved);
  }, [tenantId, active, refresh]);

  async function addClass(e: React.FormEvent) {
    e.preventDefault();
    const name = newClassName.trim();
    if (!name) return;
    setBusy("class");
    try {
      const res = await fetch(`${base}/classes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      setNewClassName("");
      await refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function deleteClass(classId: string, name: string) {
    if (!confirm(t("tenant.confirmDeleteClass", { name }))) return;
    setBusy("del-class");
    try {
      const res = await fetch(`${base}/classes/${encodeURIComponent(classId)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      await refresh();
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  if (!active) return null;

  return (
    <>
      {loadError ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{loadError}</div>
      ) : null}
      <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <BookOpen className={ICON_SECTION} aria-hidden />
            {t("tenant.classesTitle")}
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-700">
            <span>{t("tenant.bulkDownloadAllReportsIn")}</span>
            <select
              value={bulkTerm}
              onChange={(e) => setBulkTerm(e.target.value as "first" | "second" | "third")}
              className="ml-[2ch] rounded-lg border border-emerald-200 bg-white px-2 py-1.5 text-sm font-medium text-zinc-900"
              aria-label={t("class.bulkDownloadTermLabel")}
            >
              <option value="first">{t("archive.term1")}</option>
              <option value="second">{t("archive.term2")}</option>
              <option value="third">{t("archive.term3")}</option>
            </select>
            <a
              href={bulkHref}
              className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-emerald-100"
            >
              {t("tenant.downloadBulkPdfsOneFile")}
            </a>
          </div>
        </div>
        <p className="mt-2 text-xs text-zinc-500">{t("tenant.termReadinessHint")}</p>
        {isLead ? (
          <form onSubmit={addClass} className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="text-sm">
              <span className="text-zinc-600">{t("tenant.newClassName")}</span>
              <input
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                className="mt-1 block min-w-[14rem] rounded-lg border border-emerald-200 px-3 py-2"
                placeholder={t("tenant.newClassPlaceholder")}
              />
            </label>
            <button
              type="submit"
              disabled={busy !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <Plus className={ICON_INLINE} aria-hidden />
              {t("tenant.createClass")}
            </button>
          </form>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">{t("tenant.onlyLeadsCreate")}</p>
        )}

        <ul className="mt-4 divide-y divide-emerald-100">
          {classes.map((c) => {
            const classOverviewHref = `/reports/${encodeURIComponent(tenantId)}/classes/${encodeURIComponent(c.id)}?panel=overview`;
            const classStudentsHref = `/reports/${encodeURIComponent(tenantId)}/classes/${encodeURIComponent(c.id)}?panel=students`;
            return (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <Link
                  href={classOverviewHref}
                  className="min-w-0 flex-1 rounded-lg py-0.5 text-left outline-none ring-emerald-500/40 transition hover:bg-emerald-50/70 focus-visible:ring-2"
                >
                  <span className="font-medium text-zinc-900">{c.name}</span>
                  <span className="ml-2 text-sm text-zinc-500">
                    {c.student_count} {c.student_count === 1 ? t("tenant.pupil") : t("tenant.pupils")}
                  </span>
                </Link>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex items-center"
                    title={t("tenant.termReadinessHint")}
                    aria-label={t("tenant.termReadinessHint")}
                  >
                    <TermReadiness terms={termByClass[c.id]} />
                  </span>
                  <Link
                    href={classOverviewHref}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-emerald-100"
                  >
                    <DoorOpen className={ICON_INLINE} aria-hidden />
                    {t("tenant.openClass")}
                  </Link>
                  <Link
                    href={classStudentsHref}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-emerald-100"
                  >
                    <Users className={ICON_INLINE} aria-hidden />
                    {t("class.studentsTitle")}
                  </Link>
                  {isLead ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void deleteClass(c.id, c.name)}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-900 hover:bg-red-100 disabled:opacity-50"
                    >
                      <Trash2 className={ICON_INLINE} aria-hidden />
                      {t("tenant.delete")}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        {classes.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            {isLead ? t("tenant.noClassesLead") : t("tenant.noClassesTeacher")}
          </p>
        ) : null}
      </section>
    </>
  );
}
