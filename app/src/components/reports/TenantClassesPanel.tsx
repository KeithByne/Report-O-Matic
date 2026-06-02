"use client";

import { BookOpen, DoorOpen, Library, Plus, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { ICON_INLINE, ICON_SECTION } from "@/components/ui/iconSizes";
import {
  CLASS_SETTINGS_SAVED_EVENT,
  REPORT_AI_SAVED_EVENT,
  type ClassSettingsSavedDetail,
  type ReportAiSavedDetail,
} from "@/lib/appEvents";
import type { RomRole } from "@/lib/data/memberships";
import type { GradeRubricProfile } from "@/lib/gradeRubricProfile";
import {
  GRADE_RUBRIC_PROFILES,
  parseGradeRubricProfile,
} from "@/lib/gradeRubricProfile";
import {
  defaultSkillMetricLabelDrafts,
  metricLabelOverridesFromSkillDrafts,
  skillMetricLabelDraftsForSubject,
  subjectMetricLabelsStorageKey,
  SUBJECT_SKILL_METRIC_KEYS,
  type ClassMetricLabelOverrides,
  type SubjectSkillMetricKey,
} from "@/lib/classMetricLabels";
import type { TenantSubjectMetricLabelsMap } from "@/lib/data/tenantSubjectMetricLabels";
import { resolveDefaultSubjectInputToStorage } from "@/lib/subjectFormResolve";
import { subjectSuggestionLabelsByRubric } from "@/lib/subjectOptionsByEducationType";
import { isSubjectCode, REPORT_SUBJECTS } from "@/lib/subjects";

type ClassRow = { id: string; name: string; student_count: number };

type TermCompletion = { first: boolean; second: boolean; third: boolean };

export type TenantClassesPanelProps = {
  tenantId: string;
  viewerRole: RomRole;
  /** When true (panel visible), class list and term readiness are loaded; refetch each time this becomes true. */
  active: boolean;
  /** `subjects`: define subjects + create class; `classes`: class list only. */
  view: "subjects" | "classes";
};

function TermReadiness({ terms }: { terms: TermCompletion | undefined }) {
  const cls = (ok: boolean | undefined) =>
    ok === undefined ? "text-zinc-400" : ok ? "text-emerald-600" : "text-red-600";
  return (
    <span className="inline-flex items-center font-mono text-sm font-bold tabular-nums">
      <span className={cls(terms?.first)}>1</span>
      <span className="text-zinc-900">/</span>
      <span className={cls(terms?.second)}>2</span>
      <span className="text-zinc-900">/</span>
      <span className={cls(terms?.third)}>3</span>
    </span>
  );
}

/**
 * Single school “Classes” card: list, term readiness, add/delete (leads), open class + students links.
 * Shown on the dashboard workspace for leads; teachers open the same component via `/reports/[tenant]?panel=classes`.
 */
export function TenantClassesPanel({ tenantId, viewerRole, active, view }: TenantClassesPanelProps) {
  const { t, lang: uiLang } = useUiLanguage();
  const router = useRouter();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [termByClass, setTermByClass] = useState<Record<string, TermCompletion>>({});
  const [newClassName, setNewClassName] = useState("");
  const [newClassGradeRubric, setNewClassGradeRubric] = useState<GradeRubricProfile>("language");
  const [newClassDefaultSubject, setNewClassDefaultSubject] = useState("");
  const [customSubjectRows, setCustomSubjectRows] = useState<{ name: string; rubric_profile: GradeRubricProfile }[]>([]);
  const [selectedCustomSchoolSubject, setSelectedCustomSchoolSubject] = useState("");
  const [editingCustomSubject, setEditingCustomSubject] = useState<string | null>(null);
  const [editCustomDraft, setEditCustomDraft] = useState("");
  const [subjectListBusy, setSubjectListBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [bulkTerm, setBulkTerm] = useState<"first" | "second" | "third">("first");
  const [subjectMetricLabelsMap, setSubjectMetricLabelsMap] = useState<TenantSubjectMetricLabelsMap>({});
  const [skillMetricDrafts, setSkillMetricDrafts] = useState<Record<SubjectSkillMetricKey, string>>(() =>
    defaultSkillMetricLabelDrafts("language", uiLang),
  );

  const base = `/api/tenants/${encodeURIComponent(tenantId)}`;
  const isLead = viewerRole === "owner" || viewerRole === "department_head";
  const bulkHref = `${base}/reports/pdf-batch?term=${bulkTerm}`;

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const reqs: Promise<Response>[] = [
        fetch(`${base}/classes`, { cache: "no-store" }),
        fetch(`${base}/classes/term-completion`, { cache: "no-store" }),
      ];
      if (isLead) reqs.push(fetch(`${base}/settings`, { cache: "no-store" }));
      const [resClasses, resTerms, resSettings] = await Promise.all(reqs);
      const dataC = await resClasses.json().catch(() => ({}));
      if (!resClasses.ok) throw new Error(dataC.error || t("tenant.errLoadClasses"));
      setClasses(dataC.classes ?? []);
      const dataT = await resTerms.json().catch(() => ({}));
      if (resTerms.ok) setTermByClass(dataT.byClassId ?? {});
      if (resSettings) {
        const sData = await resSettings.json().catch(() => ({}));
        if (resSettings.ok) {
          setNewClassGradeRubric(parseGradeRubricProfile(sData.default_grade_rubric_profile, "language"));
        }
      }
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : t("common.loadFailed"));
    }
  }, [base, isLead, t]);

  useEffect(() => {
    if (!active) return;
    void refresh();
  }, [active, refresh]);

  const loadSubjectMetricLabelsMap = useCallback(async () => {
    if (!isLead) return;
    try {
      const res = await fetch(`${base}/subject-metric-labels`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setSubjectMetricLabelsMap((data.subject_metric_labels as TenantSubjectMetricLabelsMap) ?? {});
    } catch {
      setSubjectMetricLabelsMap({});
    }
  }, [base, isLead]);

  const rubricForSubjectDraft = useMemo(() => {
    const raw = newClassDefaultSubject.trim();
    if (!raw) return newClassGradeRubric;
    try {
      const stored = resolveDefaultSubjectInputToStorage(raw, uiLang);
      if (isSubjectCode(stored)) return "language";
      const row = customSubjectRows.find((r) => r.name.toLowerCase() === stored.toLowerCase());
      return row?.rubric_profile ?? newClassGradeRubric;
    } catch {
      return newClassGradeRubric;
    }
  }, [newClassDefaultSubject, newClassGradeRubric, customSubjectRows, uiLang]);

  const loadSubjectAccountOptions = useCallback(async () => {
    if (!isLead) return;
    try {
      const res = await fetch(`${base}/subject-options`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const custRaw = data.custom;
      const rows: { name: string; rubric_profile: GradeRubricProfile }[] = [];
      const subjectToBeDefinedLower = t("class.subjectToBeDefinedLabel").trim().toLowerCase();
      if (Array.isArray(custRaw)) {
        for (const item of custRaw) {
          if (typeof item === "string") {
            const n = item.trim();
            const lower = n.toLowerCase();
            if (n && lower !== "subject to be defined" && lower !== subjectToBeDefinedLower) {
              rows.push({ name: n, rubric_profile: "secondary" });
            }
          } else if (item && typeof item === "object") {
            const o = item as Record<string, unknown>;
            const n = typeof o.name === "string" ? o.name.trim() : "";
            const lower = n.toLowerCase();
            if (n && lower !== "subject to be defined" && lower !== subjectToBeDefinedLower)
              rows.push({
                name: n,
                rubric_profile: parseGradeRubricProfile(o.rubric_profile, "secondary"),
              });
          }
        }
      }
      setCustomSubjectRows(rows);
    } catch {
      setCustomSubjectRows([]);
    }
  }, [base, isLead, t]);

  /** Three separate `<datalist>` ids; `list` follows the current school preset. */
  const newClassSubjectSuggestionsByRubric = useMemo(
    () => subjectSuggestionLabelsByRubric(customSubjectRows, uiLang),
    [customSubjectRows, uiLang],
  );
  const newClassAllSubjectSuggestions = useMemo(
    () => [...new Set(Object.values(newClassSubjectSuggestionsByRubric).flat())],
    [newClassSubjectSuggestionsByRubric],
  );

  const newClassSubjectListId = `tenant-new-class-subject-${tenantId}-${newClassGradeRubric}`;
  const customsForCurrentRubric = useMemo(
    () => customSubjectRows.filter((r) => r.rubric_profile === newClassGradeRubric),
    [customSubjectRows, newClassGradeRubric],
  );

  useEffect(() => {
    if (!active || !isLead) return;
    void loadSubjectAccountOptions();
    void loadSubjectMetricLabelsMap();
  }, [active, isLead, loadSubjectAccountOptions, loadSubjectMetricLabelsMap]);

  useEffect(() => {
    if (!active || view !== "subjects") return;
    const raw = newClassDefaultSubject.trim();
    if (!raw) {
      setSkillMetricDrafts(defaultSkillMetricLabelDrafts(newClassGradeRubric, uiLang));
      return;
    }
    try {
      const stored = resolveDefaultSubjectInputToStorage(raw, uiLang);
      const key = subjectMetricLabelsStorageKey(stored);
      const overrides = subjectMetricLabelsMap[key];
      setSkillMetricDrafts(skillMetricLabelDraftsForSubject(rubricForSubjectDraft, uiLang, overrides));
    } catch {
      setSkillMetricDrafts(defaultSkillMetricLabelDrafts(rubricForSubjectDraft, uiLang));
    }
  }, [
    active,
    view,
    newClassDefaultSubject,
    subjectMetricLabelsMap,
    rubricForSubjectDraft,
    uiLang,
    newClassGradeRubric,
  ]);

  useEffect(() => {
    setNewClassDefaultSubject((prev) => {
      const lower = prev.trim().toLowerCase();
      const subjectToBeDefinedLower = t("class.subjectToBeDefinedLabel").trim().toLowerCase();
      if (lower === "subject to be defined" || lower === subjectToBeDefinedLower) return "";
      return prev;
    });
  }, [t]);

  useEffect(() => {
    const onClassSettingsSaved = (ev: Event) => {
      const ce = ev as CustomEvent<ClassSettingsSavedDetail>;
      const id = ce.detail?.tenantId?.trim();
      if (id && id === tenantId) {
        void refresh();
        if (isLead) void loadSubjectAccountOptions();
      }
    };
    const onReportAiSaved = (ev: Event) => {
      const ce = ev as CustomEvent<ReportAiSavedDetail>;
      const id = ce.detail?.tenantId?.trim();
      if (id && id === tenantId) void refresh();
    };
    window.addEventListener(CLASS_SETTINGS_SAVED_EVENT, onClassSettingsSaved);
    window.addEventListener(REPORT_AI_SAVED_EVENT, onReportAiSaved);
    return () => {
      window.removeEventListener(CLASS_SETTINGS_SAVED_EVENT, onClassSettingsSaved);
      window.removeEventListener(REPORT_AI_SAVED_EVENT, onReportAiSaved);
    };
  }, [tenantId, active, refresh, isLead, loadSubjectAccountOptions]);

  async function addClass(e: React.FormEvent) {
    e.preventDefault();
    const name = newClassName.trim();
    if (!name) return;
    let normalizedSubject: string;
    if (!newClassDefaultSubject.trim()) {
      alert(t("class.invalidSubject"));
      return;
    }
    try {
      normalizedSubject = resolveDefaultSubjectInputToStorage(newClassDefaultSubject, uiLang);
    } catch {
      alert(t("class.invalidSubject"));
      return;
    }
    setBusy("class");
    try {
      const lowSub = normalizedSubject.trim().toLowerCase();
      const res = await fetch(`${base}/classes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          grade_rubric_profile: newClassGradeRubric,
          default_subject: normalizedSubject,
          default_subject_rubric_profile: REPORT_SUBJECTS.some((s) => s.code === lowSub)
            ? undefined
            : newClassGradeRubric,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      setNewClassName("");
      setNewClassDefaultSubject("");
      await refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setBusy(null);
    }
  }

  async function addClassQuick(e: React.FormEvent) {
    e.preventDefault();
    if (!isLead || busy !== null) return;
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
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      setNewClassName("");
      await refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t("common.failed"));
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
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      await refresh();
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setBusy(null);
    }
  }

  async function renameCustomSchoolSubject(oldName: string) {
    let normalized: string;
    try {
      normalized = resolveDefaultSubjectInputToStorage(editCustomDraft, uiLang);
    } catch {
      alert(t("class.invalidSubject"));
      return;
    }
    setSubjectListBusy(true);
    try {
      const res = await fetch(`${base}/subject-options`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ old_name: oldName, new_name: normalized, rubric_profile: newClassGradeRubric }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || t("class.subjectRenameFailed"));
      setEditingCustomSubject(null);
      setEditCustomDraft("");
      setSelectedCustomSchoolSubject("");
      setNewClassDefaultSubject("");
      await loadSubjectAccountOptions();
      await refresh();
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t("class.subjectRenameFailed"));
    } finally {
      setSubjectListBusy(false);
    }
  }

  async function saveSubjectSkillMetricLabels() {
    const raw = newClassDefaultSubject.trim();
    if (!raw) {
      alert(t("tenant.subjectSkillMetricLabelsNeedSubject"));
      return;
    }
    let storedSubject: string;
    try {
      storedSubject = resolveDefaultSubjectInputToStorage(raw, uiLang);
    } catch {
      alert(t("class.invalidSubject"));
      return;
    }
    setSubjectListBusy(true);
    try {
      const metric_labels = metricLabelOverridesFromSkillDrafts(rubricForSubjectDraft, uiLang, skillMetricDrafts);
      const res = await fetch(`${base}/subject-metric-labels`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject: storedSubject, metric_labels }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || t("common.failed"));
      setSubjectMetricLabelsMap((data.subject_metric_labels as TenantSubjectMetricLabelsMap) ?? {});
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setSubjectListBusy(false);
    }
  }

  async function deleteCustomSchoolSubject(name: string) {
    if (!confirm(t("class.confirmDeleteCustomSubject", { name }))) return;
    setSubjectListBusy(true);
    try {
      const res = await fetch(`${base}/subject-options?name=${encodeURIComponent(name)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || t("class.subjectDeleteFailed"));
      setEditingCustomSubject(null);
      setEditCustomDraft("");
      setSelectedCustomSchoolSubject("");
      setNewClassDefaultSubject("");
      await loadSubjectAccountOptions();
      await refresh();
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t("class.subjectDeleteFailed"));
    } finally {
      setSubjectListBusy(false);
    }
  }

  if (!active) return null;

  if (view === "subjects") {
    return (
      <>
        {loadError ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{loadError}</div>
        ) : null}
        <section className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <Library className={ICON_SECTION} aria-hidden />
            {t("tenant.subjectsTitle")}
          </h2>
        {isLead ? (
          <form
            onSubmit={addClass}
            className="mt-4 space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm sm:p-5"
          >
            <div>
              <label className="block min-w-0 text-sm">
                <span className="mb-1 block font-semibold text-zinc-900">{t("tenant.addClassStep2Subject")}</span>
                <input
                  list={newClassSubjectListId}
                  value={newClassDefaultSubject}
                  onChange={(e) => setNewClassDefaultSubject(e.target.value)}
                  disabled={busy !== null || subjectListBusy}
                  placeholder={t("tenant.defineSubjectNamePlaceholder")}
                  className="mt-0 block w-full max-w-md rounded-lg border border-emerald-200 bg-white px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
                  autoComplete="off"
                  aria-label={t("tenant.addClassStep2Subject")}
                  maxLength={40}
                />
                {GRADE_RUBRIC_PROFILES.map((rp) => (
                  <datalist id={`tenant-new-class-subject-${tenantId}-${rp}`} key={rp}>
                    {newClassAllSubjectSuggestions.map((label) => (
                      <option key={`${rp}:${label}`} value={label} />
                    ))}
                  </datalist>
                ))}
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
                  <p className="text-xs font-semibold text-zinc-800">{t("class.deleteCustomSubjectSectionTitle")}</p>
                  {customsForCurrentRubric.length > 0 ? (
                    <>
                      <div className="mt-3 flex flex-wrap items-end gap-2">
                        <label className="block min-w-[12rem] flex-1 text-xs font-medium text-zinc-700">
                          <span className="mb-1 block">{t("class.chooseSubjectFromList")}</span>
                          <select
                            value={selectedCustomSchoolSubject}
                            onChange={(e) => {
                              setSelectedCustomSchoolSubject(e.target.value);
                              setEditingCustomSubject(null);
                              setEditCustomDraft("");
                            }}
                            disabled={subjectListBusy}
                            className="block w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-900"
                          >
                            <option value="">{t("class.selectSubjectInList")}</option>
                            {customsForCurrentRubric.map((row) => (
                              <option key={row.name} value={row.name}>
                                {row.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          disabled={subjectListBusy || !selectedCustomSchoolSubject}
                          onClick={() => void deleteCustomSchoolSubject(selectedCustomSchoolSubject)}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-900 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {t("class.deleteSubject")}
                        </button>
                        <button
                          type="button"
                          disabled={subjectListBusy || !selectedCustomSchoolSubject}
                          onClick={() => {
                            setEditingCustomSubject(selectedCustomSchoolSubject);
                            setEditCustomDraft(selectedCustomSchoolSubject);
                          }}
                          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {t("class.renameSelectedSubject")}
                        </button>
                      </div>
                      {editingCustomSubject ? (
                        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-zinc-200 pt-3">
                          <label className="block min-w-[12rem] flex-1 text-xs font-medium text-zinc-700">
                            <span className="mb-1 block">{t("class.newNameForSubject")}</span>
                            <input
                              value={editCustomDraft}
                              onChange={(e) => setEditCustomDraft(e.target.value)}
                              disabled={subjectListBusy}
                              className="block w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm"
                              autoComplete="off"
                              maxLength={40}
                            />
                          </label>
                          <button
                            type="button"
                            disabled={subjectListBusy}
                            onClick={() => void renameCustomSchoolSubject(editingCustomSubject)}
                            className="rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 disabled:opacity-50"
                          >
                            {t("class.saveCustomSubjectRename")}
                          </button>
                          <button
                            type="button"
                            disabled={subjectListBusy}
                            onClick={() => {
                              setEditingCustomSubject(null);
                              setEditCustomDraft("");
                            }}
                            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-700 disabled:opacity-50"
                          >
                            {t("class.cancelCustomSubjectRename")}
                          </button>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-zinc-500">{t("class.noCustomSubjectsForEducationType")}</p>
                  )}
                </div>
              </label>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-4">
              <h3 className="text-sm font-semibold text-zinc-900">{t("tenant.subjectSkillMetricLabelsTitle")}</h3>
              <p className="mt-1 text-xs text-zinc-500">{t("tenant.subjectSkillMetricLabelsHint")}</p>
              {!newClassDefaultSubject.trim() ? (
                <p className="mt-3 text-xs text-amber-800">{t("tenant.subjectSkillMetricLabelsNeedSubject")}</p>
              ) : (
                <>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {SUBJECT_SKILL_METRIC_KEYS.map((key) => (
                      <label key={key} className="block min-w-0 text-xs font-medium text-zinc-700">
                        <input
                          value={skillMetricDrafts[key]}
                          onChange={(e) =>
                            setSkillMetricDrafts((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          disabled={subjectListBusy || busy !== null}
                          className="block w-full rounded-lg border border-emerald-200 bg-white px-2 py-2 text-sm text-zinc-900 disabled:opacity-50"
                          maxLength={80}
                          autoComplete="off"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={subjectListBusy || busy !== null}
                      onClick={() => void saveSubjectSkillMetricLabels()}
                      className="rounded-lg bg-emerald-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {t("tenant.saveSubjectSkillMetricLabels")}
                    </button>
                    <button
                      type="button"
                      disabled={subjectListBusy || busy !== null}
                      onClick={() =>
                        setSkillMetricDrafts(defaultSkillMetricLabelDrafts(rubricForSubjectDraft, uiLang))
                      }
                      className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs font-medium text-zinc-800 disabled:opacity-50"
                    >
                      {t("tenant.subjectSkillMetricLabelsReset")}
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="border-t border-emerald-200/80 pt-4">
              <label className="block min-w-0 text-sm">
                <span className="mb-1 block font-semibold text-zinc-900">{t("tenant.addClassStep3Name")}</span>
                <input
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  disabled={busy !== null}
                  className="mt-0 block w-full max-w-md rounded-lg border border-emerald-200 px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
                  placeholder={t("tenant.newClassPlaceholder")}
                  maxLength={30}
                />
              </label>
              <div className="mt-4">
                <button
                  type="submit"
                  disabled={busy !== null || !newClassName.trim() || !newClassDefaultSubject.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Plus className={ICON_INLINE} aria-hidden />
                  {t("tenant.createClass")}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">{t("tenant.onlyLeadsCreate")}</p>
        )}

        </section>
      </>
    );
  }

  return (
    <>
      {loadError ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{loadError}</div>
      ) : null}
      <section className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <BookOpen className={ICON_SECTION} aria-hidden />
          {t("tenant.classesTitle")}
        </h2>
        {isLead ? (
          <form onSubmit={(e) => void addClassQuick(e)} className="mt-4 flex flex-wrap items-center gap-2">
            <input
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              disabled={busy !== null}
              className="min-w-[12rem] flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
              placeholder={t("tenant.newClassPlaceholder")}
              maxLength={30}
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={busy !== null || !newClassName.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Plus className={ICON_INLINE} aria-hidden />
              {t("tenant.createClass")}
            </button>
          </form>
        ) : null}
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