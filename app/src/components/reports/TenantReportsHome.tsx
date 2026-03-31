"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import type { RomRole } from "@/lib/data/memberships";
import { REPORT_LANGUAGES, type ReportLanguageCode } from "@/lib/i18n/reportLanguages";

type ClassRow = {
  id: string;
  name: string;
  student_count: number;
};

type Props = { tenantId: string; schoolName: string; viewerRole: RomRole };

export function TenantReportsHome({ tenantId, schoolName, viewerRole }: Props) {
  const { t } = useUiLanguage();
  const router = useRouter();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [lang, setLang] = useState<ReportLanguageCode>("en");
  const [newClassName, setNewClassName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherOnlyFinal, setTeacherOnlyFinal] = useState(false);
  const [teacherOrder, setTeacherOrder] = useState<"updated_desc" | "updated_asc" | "student">("updated_desc");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const base = `/api/tenants/${encodeURIComponent(tenantId)}`;

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const [cRes, sRes] = await Promise.all([fetch(`${base}/classes`), fetch(`${base}/settings`)]);
      const cData = await cRes.json().catch(() => ({}));
      const sData = await sRes.json().catch(() => ({}));
      if (!cRes.ok) throw new Error(cData.error || "Failed to load classes");
      if (!sRes.ok) throw new Error(sData.error || "Failed to load settings");
      setClasses(cData.classes ?? []);
      if (typeof sData.default_report_language === "string") {
        const code = sData.default_report_language as ReportLanguageCode;
        if (REPORT_LANGUAGES.some((x) => x.code === code)) setLang(code);
      }
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : "Load failed");
    }
  }, [base]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
      if (!res.ok) throw new Error(data.error || "Failed to save");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

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

  const isLead = viewerRole === "owner" || viewerRole === "department_head";
  const teacherBatchHref = (() => {
    const qp = new URLSearchParams();
    qp.set("author", (teacherEmail || "").trim().toLowerCase());
    if (teacherOnlyFinal) qp.set("onlyFinal", "1");
    if (teacherOrder) qp.set("order", teacherOrder);
    return `${base}/reports/pdf-batch?${qp.toString()}`;
  })();

  async function deleteClass(classId: string, name: string) {
    if (!confirm(`Delete class "${name}"?`)) return;
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

  return (
    <div className="space-y-8">
      {viewerRole === "owner" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-950">
          <p className="font-semibold text-emerald-900">{t("tenant.ownerBannerTitle")}</p>
          <p className="mt-2 text-emerald-900/90">{t("tenant.ownerBannerBody", { school: schoolName })}</p>
        </div>
      ) : viewerRole === "department_head" ? (
        <div className="rounded-2xl border border-teal-200 bg-teal-50/80 p-4 text-sm text-teal-950">
          <p className="font-semibold text-teal-900">{t("tenant.dhBannerTitle")}</p>
          <p className="mt-2 text-teal-900/90">{t("tenant.dhBannerBody", { school: schoolName })}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-green-200 bg-green-50/80 p-4 text-sm text-green-950">
          <p className="font-semibold text-green-900">{t("tenant.teacherBannerTitle")}</p>
          <p className="mt-2 text-green-900/90">{t("tenant.teacherBannerBody")}</p>
        </div>
      )}

      <p className="text-sm text-zinc-600">
        {isLead ? t("tenant.introLead", { school: schoolName }) : t("tenant.introTeacher")}
      </p>

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{loadError}</div>
      ) : null}

      <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">
          <span className="mr-1" aria-hidden>
            🌐
          </span>
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
                {o.label}
              </option>
            ))}
          </select>
          {busy === "lang" ? <span className="text-xs text-zinc-500">{t("tenant.saving")}</span> : null}
        </div>
      </section>

      {isLead ? (
        <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Bulk downloads</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Download many reports as one combined PDF for faster printing.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="text-sm">
              <span className="text-zinc-600">Teacher email</span>
              <input
                value={teacherEmail}
                onChange={(e) => setTeacherEmail(e.target.value)}
                className="mt-1 block min-w-[16rem] rounded-lg border border-emerald-200 px-3 py-2"
                placeholder="teacher@school.com"
              />
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={teacherOnlyFinal}
                onChange={(e) => setTeacherOnlyFinal(e.target.checked)}
                className="h-4 w-4"
              />
              Final only
            </label>
            <label className="text-sm">
              <span className="text-zinc-600">Order</span>
              <select
                value={teacherOrder}
                onChange={(e) => setTeacherOrder(e.target.value as typeof teacherOrder)}
                className="mt-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
              >
                <option value="updated_desc">Last updated (newest first)</option>
                <option value="updated_asc">Last updated (oldest first)</option>
                <option value="student">Student name</option>
              </select>
            </label>
            <a
              href={teacherBatchHref}
              className={`rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-emerald-100 ${
                teacherEmail.trim() ? "" : "pointer-events-none opacity-50"
              }`}
            >
              Download teacher PDFs (one file)
            </a>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">{t("tenant.classesTitle")}</h2>
        {isLead ? (
          <form onSubmit={addClass} className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="text-sm">
              <span className="text-zinc-600">{t("tenant.newClassName")}</span>
              <input
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                className="mt-1 block min-w-[14rem] rounded-lg border border-emerald-200 px-3 py-2"
                placeholder="e.g. Year 7A"
              />
            </label>
            <button
              type="submit"
              disabled={busy !== null}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {t("tenant.createClass")}
            </button>
          </form>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">{t("tenant.onlyLeadsCreate")}</p>
        )}

        <ul className="mt-4 divide-y divide-emerald-100">
          {classes.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <span className="font-medium text-zinc-900">{c.name}</span>
                <span className="ml-2 text-sm text-zinc-500">
                  {c.student_count} {c.student_count === 1 ? t("tenant.pupil") : t("tenant.pupils")}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/reports/${tenantId}/classes/${c.id}`}
                  className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-emerald-100"
                >
                  {t("tenant.openClass")}
                </Link>
                {isLead ? (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void deleteClass(c.id, c.name)}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-900 hover:bg-red-100 disabled:opacity-50"
                  >
                    {t("tenant.delete")}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        {classes.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            {isLead ? t("tenant.noClassesLead") : t("tenant.noClassesTeacher")}
          </p>
        ) : null}
      </section>
    </div>
  );
}
