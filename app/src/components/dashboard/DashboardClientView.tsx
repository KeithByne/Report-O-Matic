"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Briefcase,
  CalendarDays,
  Download,
  ArrowDown,
  Building2,
  ClipboardList,
  CreditCard,
  FileCheck,
  FileImage,
  FileSpreadsheet,
  FolderKanban,
  LayoutDashboard,
  LayoutList,
  Library,
  NotebookText,
  Printer,
  LogOut,
  RefreshCw,
  RotateCcw,
  Save,
  Share2,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AddSchoolForm } from "@/components/dashboard/AddSchoolForm";
import { TenantClassesPanel } from "@/components/reports/TenantClassesPanel";
import { DashboardScholasticArchivesOverview } from "@/components/dashboard/DashboardScholasticArchivesOverview";
import { DashboardRosterTable } from "@/components/dashboard/DashboardRosterTable";
import { DashboardTenantLanguage } from "@/components/dashboard/DashboardTenantLanguage";
import { DashboardTenantPdfLetterhead } from "@/components/dashboard/DashboardTenantPdfLetterhead";
import { DashboardTimetableSnippet } from "@/components/dashboard/DashboardTimetableSnippet";
import { CLASS_SETTINGS_SAVED_EVENT, type ClassSettingsSavedDetail } from "@/lib/appEvents";
import { classesListHref } from "@/lib/app/classesNavigation";
import { openPdfForPrint } from "@/lib/app/openPdfForPrint";
import { ProfileEditor } from "@/components/dashboard/ProfileEditor";
import { TeacherDownloadsCard } from "@/components/dashboard/TeacherDownloadsCard";
import { DashboardStagedGuide } from "@/components/dashboard/DashboardStagedGuide";
import { OverviewDataPrivacySection } from "@/components/dashboard/OverviewDataPrivacySection";
import { DeleteSchoolButton } from "@/components/dashboard/DeleteSchoolButton";
import { InviteTeamForm } from "@/components/dashboard/InviteTeamForm";
import { TimetablePageClient } from "@/components/timetable/TimetablePageClient";
import { GlobeLanguageSwitcher } from "@/components/i18n/GlobeLanguageSwitcher";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { AppHeaderLeftCluster } from "@/components/layout/AppHeaderLeftCluster";
import { DisplayModeSwitcher } from "@/components/ui/DisplayModeSwitcher";
import { ICON_INLINE, ICON_SECTION } from "@/components/ui/iconSizes";
import type { MembershipWithTenant, RomRole, TenantMemberRow } from "@/lib/data/memberships";
import { GRADE_RUBRIC_PROFILES, gradeRubricProfileDisplayLabel, parseGradeRubricProfile, type GradeRubricProfile } from "@/lib/gradeRubricProfile";
import { isReportLanguageCode, type ReportLanguageCode } from "@/lib/i18n/reportLanguages";
import type { TeacherStats, TenantSummaryStats } from "@/lib/data/tenantDashboardStats";
import { scrollPanelContentTopIntoView } from "@/lib/ui/scrollPanelContentIntoView";

type MyAgentLink = {
  code: string;
  agent_email: string;
  display_name: string | null;
  // Note: owners should not control commission/wait/active; those are SaaS-owner controls.
  commission_bps?: number;
  payout_stripe_account_id?: string | null;
};

type WorkspaceDashPanel = "overview" | "pdf" | "invites" | "subjects" | "classes" | "timetable" | "schoolType";

type TeacherWorkspacePanel = "profile" | "classes" | "downloads";

export type DashboardClientViewProps = {
  email: string;
  userDisplayName: string;
  loadError: string | null;
  memberships: MembershipWithTenant[];
  rosterByTenant: Record<string, TenantMemberRow[]>;
  summaryByTenant: Record<string, TenantSummaryStats>;
  teacherStatsByTenant: Record<string, TeacherStats[]>;
  /** Shared pool for this signed-in email when they own at least one school. */
  ownerReportCredits: number | null;
  /** Billing checkout is per-URL; use first owned school for “buy credits”. */
  firstOwnerTenantId: string | null;
  /** From `/dashboard?panel=classes&tenant=` — open that school’s Classes workspace card once. */
  bootOpenClassesPanel?: string | null;
  /** False when ROM_STRIPE_ENABLED is not true (card checkout and payout fields paused). */
  stripePaymentsEnabled: boolean;
};

export function DashboardClientView({
  email,
  userDisplayName,
  loadError,
  memberships,
  rosterByTenant,
  summaryByTenant,
  teacherStatsByTenant,
  ownerReportCredits,
  firstOwnerTenantId,
  bootOpenClassesPanel = null,
  stripePaymentsEnabled,
}: DashboardClientViewProps) {
  const { t, lang: uiLang } = useUiLanguage();
  const router = useRouter();
  const classesBootApplied = useRef(false);

  const reportsClassesHref = (tenantId: string, role: MembershipWithTenant["role"]) =>
    classesListHref(tenantId, role);

  const hasOwner = memberships.some((m) => m.role === "owner");
  const hasDeptHead = memberships.some((m) => m.role === "department_head");
  const hasTeacherOnly = memberships.length > 0 && memberships.every((m) => m.role === "teacher");
  const teacherMemberships = useMemo(() => memberships.filter((m) => m.role === "teacher"), [memberships]);

  const [reportLangByTenant, setReportLangByTenant] = useState<Record<string, ReportLanguageCode>>({});
  const [myAgent, setMyAgent] = useState<MyAgentLink | null>(null);
  const [myAgentBusy, setMyAgentBusy] = useState(false);
  const [myAgentErr, setMyAgentErr] = useState<string | null>(null);
  const [myAgentEdit, setMyAgentEdit] = useState<Partial<MyAgentLink>>({});
  const [myAgentSaving, setMyAgentSaving] = useState(false);

  const uniqueSchools = useMemo(() => {
    const byId = new Map<string, string>();
    for (const m of memberships) {
      if (!byId.has(m.tenantId)) byId.set(m.tenantId, m.tenantName);
    }
    return [...byId.entries()].sort((a, b) =>
      a[1].localeCompare(b[1], undefined, { sensitivity: "base" }),
    );
  }, [memberships]);
  const ownerTenantIds = useMemo(
    () => new Set(memberships.filter((m) => m.role === "owner").map((m) => m.tenantId)),
    [memberships],
  );

  /** Schools where this user is department head (alphabetical); used to pick a default workspace without a selector. */
  const deptHeadSchools = useMemo(() => {
    const byId = new Map<string, string>();
    for (const m of memberships) {
      if (m.role === "department_head" && !byId.has(m.tenantId)) {
        byId.set(m.tenantId, m.tenantName);
      }
    }
    return [...byId.entries()].sort((a, b) =>
      a[1].localeCompare(b[1], undefined, { sensitivity: "base" }),
    );
  }, [memberships]);

  const [ownerFocusTenantId, setOwnerFocusTenantId] = useState<string | null>(null);
  const userClearedSchoolFocus = useRef(false);
  const [dhFocusTenantId, setDhFocusTenantId] = useState<string | null>(null);
  const [agentStartupOpen, setAgentStartupOpen] = useState(false);

  useEffect(() => {
    if (!hasOwner || memberships.length === 0) {
      userClearedSchoolFocus.current = false;
      setOwnerFocusTenantId(null);
      return;
    }
    const ids = uniqueSchools.map(([id]) => id);
    if (ids.length === 0) {
      setOwnerFocusTenantId(null);
      return;
    }
    setOwnerFocusTenantId((prev) => {
      if (ids.length === 1) {
        if (userClearedSchoolFocus.current) return null;
        return prev ?? ids[0];
      }
      if (prev && ids.includes(prev)) return prev;
      return null;
    });
  }, [hasOwner, memberships, uniqueSchools]);

  useEffect(() => {
    if (hasOwner || !hasDeptHead) {
      setDhFocusTenantId(null);
      return;
    }
    const ids = deptHeadSchools.map(([id]) => id);
    setDhFocusTenantId(ids.length > 0 ? ids[0] : null);
  }, [hasOwner, hasDeptHead, deptHeadSchools]);

  useEffect(() => {
    if (ownerFocusTenantId) setAgentStartupOpen(false);
  }, [ownerFocusTenantId]);

  const visibleMemberships = useMemo(() => {
    if (memberships.length === 0) return [];
    if (hasOwner) {
      if (!ownerFocusTenantId) return [];
      return memberships.filter((m) => m.tenantId === ownerFocusTenantId);
    }
    if (hasDeptHead) {
      if (!dhFocusTenantId) return [];
      return memberships.filter((m) => m.tenantId === dhFocusTenantId);
    }
    return memberships;
  }, [hasOwner, hasDeptHead, memberships, ownerFocusTenantId, dhFocusTenantId]);

  const usesSchoolWorkspaceMenu = visibleMemberships.length > 0 && (hasOwner || hasDeptHead);
  const usesTeacherWorkspaceMenu = hasTeacherOnly && memberships.length > 0;
  const deptHeadOnlyWorkspace = usesSchoolWorkspaceMenu && !hasOwner;

  /** Owner with a school focused: hub hidden; only workspace button nav (+ optional panels below). */
  const ownerSchoolMenuOnly = hasOwner && Boolean(ownerFocusTenantId);

  const primaryMembership = useMemo(() => {
    if (visibleMemberships.length === 0) return null;
    const rank: Record<RomRole, number> = { owner: 0, department_head: 1, teacher: 2 };
    let best = visibleMemberships[0];
    for (const m of visibleMemberships) {
      if (rank[m.role] < rank[best.role]) best = m;
    }
    return best;
  }, [visibleMemberships]);

  const [workspaceDashPanel, setWorkspaceDashPanel] = useState<WorkspaceDashPanel | null>(null);
  const [teacherWorkspacePanel, setTeacherWorkspacePanel] = useState<TeacherWorkspacePanel | null>(null);
  const [workspaceGuideHoverKey, setWorkspaceGuideHoverKey] = useState<string | null>(null);
  const [teacherGuideHoverKey, setTeacherGuideHoverKey] = useState<string | null>(null);

  const toggleWorkspacePanel = useCallback((panel: WorkspaceDashPanel) => {
    setWorkspaceDashPanel((cur) => (cur === panel ? null : panel));
  }, []);

  const toggleTeacherWorkspacePanel = useCallback((panel: TeacherWorkspacePanel) => {
    setTeacherWorkspacePanel((cur) => (cur === panel ? null : panel));
  }, []);

  const teacherMenuButtonClass = (panel: TeacherWorkspacePanel) =>
    `inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
      teacherWorkspacePanel === panel
        ? "border-emerald-600 bg-emerald-100 text-emerald-950"
        : "border-emerald-200 bg-emerald-50/60 text-zinc-800 hover:bg-emerald-100"
    }`;
  const [schoolGradeRubricByTenant, setSchoolGradeRubricByTenant] = useState<Record<string, GradeRubricProfile>>({});
  const [schoolTypeSaving, setSchoolTypeSaving] = useState(false);

  useEffect(() => {
    if (!usesSchoolWorkspaceMenu) {
      setWorkspaceDashPanel(null);
      setWorkspaceGuideHoverKey(null);
    }
  }, [usesSchoolWorkspaceMenu]);

  useEffect(() => {
    if (classesBootApplied.current || !bootOpenClassesPanel) return;
    const tenant = bootOpenClassesPanel;
    const m = memberships.find((x) => x.tenantId === tenant);
    if (!m) return;
    classesBootApplied.current = true;
    if (m.role === "teacher") {
      router.replace(`/reports/${encodeURIComponent(tenant)}?panel=classes`);
      return;
    }
    queueMicrotask(() => {
      if (m.role === "owner") {
        userClearedSchoolFocus.current = false;
        setOwnerFocusTenantId(tenant);
      } else if (m.role === "department_head") {
        setDhFocusTenantId(tenant);
      }
      setWorkspaceDashPanel("classes");
    });
  }, [bootOpenClassesPanel, memberships, router]);

  useEffect(() => {
    if (!workspaceDashPanel) return;
    const el = document.getElementById(`dash-workspace-panel-${workspaceDashPanel}`);
    scrollPanelContentTopIntoView(el);
  }, [workspaceDashPanel]);

  useEffect(() => {
    if (!teacherWorkspacePanel) return;
    const el = document.getElementById(`dash-teacher-panel-${teacherWorkspacePanel}`);
    scrollPanelContentTopIntoView(el);
  }, [teacherWorkspacePanel]);

  useEffect(() => {
    if (!agentStartupOpen) return;
    scrollPanelContentTopIntoView(document.getElementById("dash-agent-expanded"));
  }, [agentStartupOpen]);

  const showWorkspacePdfTab = visibleMemberships.some((m) => m.role === "owner");
  const showWorkspaceInvitesTab = visibleMemberships.some(
    (m) => m.role === "owner" || m.role === "department_head",
  );
  const showWorkspaceDownloadsTab = visibleMemberships.some(
    (m) => m.role === "owner" || m.role === "department_head",
  );
  const menuOverviewSummary = useMemo(() => {
    if (!primaryMembership) return undefined;
    if (primaryMembership.role !== "owner" && primaryMembership.role !== "department_head") return undefined;
    return summaryByTenant[primaryMembership.tenantId];
  }, [primaryMembership, summaryByTenant]);

  const refreshReportLangs = useCallback(async () => {
    const targets =
      hasOwner || hasDeptHead
        ? visibleMemberships.length > 0
          ? visibleMemberships
          : []
        : memberships;
    if (targets.length === 0) {
      setReportLangByTenant({});
      return;
    }
    const next: Record<string, ReportLanguageCode> = {};
    await Promise.all(
      targets.map(async (m) => {
        const res = await fetch(`/api/tenants/${encodeURIComponent(m.tenantId)}/settings`);
        const data = await res.json().catch(() => ({}));
        const raw = typeof data.default_report_language === "string" ? data.default_report_language.trim() : "";
        next[m.tenantId] = res.ok && isReportLanguageCode(raw) ? raw : "en";
        const rubric = parseGradeRubricProfile(data.default_grade_rubric_profile, "language");
        setSchoolGradeRubricByTenant((prev) => ({ ...prev, [m.tenantId]: rubric }));
      }),
    );
    setReportLangByTenant(next);
  }, [hasOwner, hasDeptHead, memberships, visibleMemberships]);

  useEffect(() => {
    void refreshReportLangs();
  }, [refreshReportLangs]);

  const refreshMyAgent = useCallback(async () => {
    if (!hasOwner) return;
    setMyAgentBusy(true);
    setMyAgentErr(null);
    try {
      const res = await fetch("/api/agent-link/me", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      setMyAgent((data.agent ?? null) as MyAgentLink | null);
      setMyAgentEdit({});
    } catch (e: unknown) {
      setMyAgentErr(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setMyAgentBusy(false);
    }
  }, [hasOwner, t]);

  useEffect(() => {
    void refreshMyAgent();
  }, [refreshMyAgent]);

  function roleLabel(role: RomRole): string {
    switch (role) {
      case "owner":
        return t("dash.role.owner");
      case "department_head":
        return t("dash.role.department_head");
      case "teacher":
        return t("dash.role.teacher");
      default:
        return role;
    }
  }

  function roleDescription(role: RomRole): string {
    switch (role) {
      case "owner":
        return t("dash.roleDesc.owner");
      case "department_head":
        return t("dash.roleDesc.department_head");
      case "teacher":
        return t("dash.roleDesc.teacher");
      default:
        return "";
    }
  }

  async function saveSchoolEducationType(tenantId: string, next: GradeRubricProfile) {
    setSchoolGradeRubricByTenant((prev) => ({ ...prev, [tenantId]: next }));
    setSchoolTypeSaving(true);
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/settings`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ default_grade_rubric_profile: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      window.dispatchEvent(
        new CustomEvent<ClassSettingsSavedDetail>(CLASS_SETTINGS_SAVED_EVENT, { detail: { tenantId } }),
      );
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setSchoolTypeSaving(false);
    }
  }

  const headerRoleLine = useMemo(() => {
    const uniq = [...new Set(memberships.map((m) => m.role))];
    return uniq.map((r) => roleLabel(r)).join(" · ");
  }, [memberships, t]);

  return (
    <div className="min-h-screen bg-emerald-50/80 text-zinc-950">
      <header className="rom-app-shell-header">
        <div
          className={`mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 ${ownerSchoolMenuOnly ? "py-3" : "py-4"}`}
        >
          {ownerSchoolMenuOnly ? (
            <>
              <AppHeaderLeftCluster
                roleLabel={headerRoleLine}
                userDisplayName={userDisplayName}
                pageTitle={t("dash.title")}
              />
              <div className="flex w-full min-w-0 flex-1 items-center justify-end gap-2 sm:w-auto sm:flex-none sm:flex-nowrap">
                <GlobeLanguageSwitcher />
                <DisplayModeSwitcher />
                <form action="/api/auth/sign-out" method="post" className="shrink-0">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm hover:bg-emerald-50/60"
                  >
                    <LogOut className={ICON_INLINE} aria-hidden />
                    {t("nav.signOut")}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <>
              <AppHeaderLeftCluster
                roleLabel={headerRoleLine}
                userDisplayName={userDisplayName}
                pageTitle={t("dash.title")}
              />
              <div className="flex w-full min-w-0 flex-1 items-center justify-end gap-2 sm:w-auto sm:flex-none sm:flex-nowrap">
                <GlobeLanguageSwitcher />
                <DisplayModeSwitcher />
                <form action="/api/auth/sign-out" method="post" className="shrink-0">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm hover:bg-emerald-50/60"
                  >
                    <LogOut className={ICON_INLINE} aria-hidden />
                    {t("nav.signOut")}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </header>

      <main
        className={`mx-auto max-w-4xl px-5 ${ownerSchoolMenuOnly ? "space-y-8 py-6" : "space-y-8 py-8"}`}
      >
        {ownerSchoolMenuOnly ? null : (
          <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
          <h2 className="m-0 flex flex-wrap items-baseline gap-x-[3ch] gap-y-1 text-sm">
            <span className="inline-flex items-center gap-2 font-medium text-zinc-500">
              <UserRound className={ICON_INLINE} aria-hidden />
              {t("dash.signedInAs")}
            </span>
            <span className="min-w-0 break-all font-mono font-normal text-zinc-900">{email}</span>
          </h2>
          {hasOwner && ownerReportCredits !== null ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50/60 px-3 py-2.5">
              <p className="text-base font-semibold tabular-nums text-teal-950 sm:text-lg">
                {t("dash.ownerCreditsRemaining", { n: ownerReportCredits })}
              </p>
              {firstOwnerTenantId ? (
                <Link
                  href={`/reports/${encodeURIComponent(firstOwnerTenantId)}/billing`}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-teal-800 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-900"
                >
                  <CreditCard className={ICON_INLINE} aria-hidden />
                  {t("dash.ownerCreditsBuy")}
                </Link>
              ) : null}
            </div>
          ) : null}

          {teacherMemberships.length > 0 && !usesTeacherWorkspaceMenu ? (
            <div className="mt-5 rounded-xl border border-emerald-300/70 bg-gradient-to-br from-emerald-50/95 to-white p-4 shadow-sm ring-1 ring-emerald-100 sm:p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
                <NotebookText className={ICON_INLINE} aria-hidden />
                {t("dash.teacherRegistersCalloutTitle")}
              </h3>
              <p className="mt-1 text-sm text-zinc-700">{t("dash.teacherRegistersCalloutHint")}</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {teacherMemberships.map((m) => (
                  <button
                    key={m.tenantId}
                    type="button"
                    onClick={() =>
                      openPdfForPrint(
                        `/api/tenants/${encodeURIComponent(m.tenantId)}/teacher/registers-pdf?lang=${encodeURIComponent(uiLang)}`,
                      )
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-600 bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 sm:min-w-[14rem]"
                  >
                    <Printer className={ICON_INLINE} aria-hidden />
                    {teacherMemberships.length > 1 ? `${m.tenantName} — ` : null}
                    {t("dash.teacherDownloadsPrintMyRegisters")}
                  </button>
                ))}
              </div>
              </div>
          ) : null}

          {hasOwner && memberships.length > 0 ? (
            <p className="mt-4 text-sm">
              <Link
                href="/dashboard/profile"
                className="inline-flex items-center gap-2 font-medium text-emerald-900 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-950"
              >
                <UserRound className={ICON_INLINE} aria-hidden />
                {t("dash.profileButton")}
              </Link>
            </p>
          ) : null}

          {hasOwner && memberships.length > 0 && !ownerFocusTenantId ? (
            <div className="mt-6 space-y-8 border-t border-emerald-100 pt-6">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
                  <Building2 className={ICON_INLINE} aria-hidden />
                  {t("dash.ownerHubAddSchool")}
                </h2>
                <div className="mt-3">
                  <AddSchoolForm embedded suppressEmbeddedHeading />
                </div>
              </div>
              <div className="border-t border-emerald-100 pt-8">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
                  <Building2 className={ICON_INLINE} aria-hidden />
                  {t("dash.schoolFocusTitle")}
                </h2>
                <ul className="mt-4 space-y-2" role="radiogroup" aria-label={t("dash.schoolFocusTitle")}>
                  {uniqueSchools.map(([tenantId, tenantName]) => (
                    <li key={tenantId}>
                      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2.5">
                        <label
                          className="flex min-w-0 flex-1 cursor-pointer flex-wrap items-center gap-x-3 gap-y-2"
                          onClick={(e) => {
                            if (ownerFocusTenantId === tenantId) {
                              e.preventDefault();
                              userClearedSchoolFocus.current = true;
                              setOwnerFocusTenantId(null);
                              setWorkspaceDashPanel(null);
                              setWorkspaceGuideHoverKey(null);
                            }
                          }}
                        >
                          <input
                            type="radio"
                            name="owner-school-focus"
                            className="h-4 w-4 border-emerald-300 text-emerald-800"
                            checked={ownerFocusTenantId === tenantId}
                            onChange={() => {
                              userClearedSchoolFocus.current = false;
                              setOwnerFocusTenantId(tenantId);
                              setWorkspaceDashPanel(null);
                              setWorkspaceGuideHoverKey(null);
                            }}
                          />
                          <span className="min-w-0 flex-1 font-medium text-zinc-900">{tenantName}</span>
                        </label>
                        {ownerTenantIds.has(tenantId) ? (
                          <DeleteSchoolButton
                            tenantId={tenantId}
                            schoolName={tenantName}
                            className="mt-0 shrink-0"
                          />
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {hasOwner && memberships.length > 0 && !ownerFocusTenantId ? (
            <DashboardStagedGuide mode="owner_hub" />
          ) : null}

          {usesSchoolWorkspaceMenu && memberships.length > 0 && primaryMembership && !hasOwner ? (
            <div
              className="mt-5 border-t border-emerald-100 pt-5"
              onMouseLeave={() => setWorkspaceGuideHoverKey(null)}
            >
                <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
                    <FolderKanban className={ICON_INLINE} aria-hidden />
                    {t("dash.teacherShowSelectionTitle")}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-600">{t("tenant.sectionMenuHint")}</p>
                  <nav
                    className="mt-4 flex flex-wrap gap-2"
                    aria-label={t("dash.teacherShowSelectionTitle")}
                  >
                    <Link
                      href="/dashboard/profile"
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-emerald-100"
                    >
                      <UserRound className={ICON_INLINE} aria-hidden />
                      {t("dash.profileButton")}
                    </Link>
                    <button
                      type="button"
                      aria-pressed={workspaceDashPanel === "overview"}
                      onMouseEnter={() => setWorkspaceGuideHoverKey("dh_overview")}
                      onFocus={() => setWorkspaceGuideHoverKey("dh_overview")}
                      onClick={() => toggleWorkspacePanel("overview")}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        workspaceDashPanel === "overview"
                          ? "border-emerald-600 bg-emerald-100 text-emerald-950"
                          : "border-emerald-200 bg-emerald-50/60 text-zinc-800 hover:bg-emerald-100"
                      }`}
                    >
                      <LayoutList className={ICON_INLINE} aria-hidden />
                      {t("dash.panelOverview")}
                    </button>
                    {showWorkspaceInvitesTab ? (
                      <button
                        type="button"
                        aria-pressed={workspaceDashPanel === "invites"}
                        onMouseEnter={() => setWorkspaceGuideHoverKey("dh_invite")}
                        onFocus={() => setWorkspaceGuideHoverKey("dh_invite")}
                        onClick={() => toggleWorkspacePanel("invites")}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                          workspaceDashPanel === "invites"
                            ? "border-emerald-600 bg-emerald-100 text-emerald-950"
                            : "border-emerald-200 bg-emerald-50/60 text-zinc-800 hover:bg-emerald-100"
                        }`}
                      >
                        <UserPlus className={ICON_INLINE} aria-hidden />
                        {t("dash.panelInviteTeam")}
                      </button>
                    ) : null}
                    {deptHeadOnlyWorkspace ? (
                      <>
                        <button
                          type="button"
                          aria-pressed={workspaceDashPanel === "subjects"}
                          onMouseEnter={() => setWorkspaceGuideHoverKey("dh_subjects")}
                          onFocus={() => setWorkspaceGuideHoverKey("dh_subjects")}
                          onClick={() => toggleWorkspacePanel("subjects")}
                          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                            workspaceDashPanel === "subjects"
                              ? "border-emerald-600 bg-emerald-100 text-emerald-950"
                              : "border-emerald-200 bg-emerald-50/60 text-zinc-800 hover:bg-emerald-100"
                          }`}
                        >
                          <Library className={ICON_INLINE} aria-hidden />
                          {t("tenant.panelSubjects")}
                        </button>
                        <button
                          type="button"
                          aria-pressed={workspaceDashPanel === "classes"}
                          onMouseEnter={() => setWorkspaceGuideHoverKey("dh_classes")}
                          onFocus={() => setWorkspaceGuideHoverKey("dh_classes")}
                          onClick={() => toggleWorkspacePanel("classes")}
                          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                            workspaceDashPanel === "classes"
                              ? "border-emerald-600 bg-emerald-100 text-emerald-950"
                              : "border-emerald-200 bg-emerald-50/60 text-zinc-800 hover:bg-emerald-100"
                          }`}
                        >
                          <BookOpen className={ICON_INLINE} aria-hidden />
                          {t("tenant.panelClasses")}
                        </button>
                        <button
                          type="button"
                          aria-pressed={workspaceDashPanel === "timetable"}
                          onMouseEnter={() => setWorkspaceGuideHoverKey("dh_timetable")}
                          onFocus={() => setWorkspaceGuideHoverKey("dh_timetable")}
                          onClick={() => toggleWorkspacePanel("timetable")}
                          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                            workspaceDashPanel === "timetable"
                              ? "border-emerald-600 bg-emerald-100 text-emerald-950"
                              : "border-emerald-200 bg-emerald-50/60 text-zinc-800 hover:bg-emerald-100"
                          }`}
                        >
                          <CalendarDays className={ICON_INLINE} aria-hidden />
                          {t("tenant.panelTimetable")}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            openPdfForPrint(
                              `/api/tenants/${encodeURIComponent(primaryMembership.tenantId)}/school/registers-pdf?lang=${encodeURIComponent(uiLang)}`,
                            )
                          }
                          className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-emerald-100"
                        >
                          <Printer className={ICON_INLINE} aria-hidden />
                          {t("dash.ownerAllRegisterLists")}
                        </button>
                      </>
                    ) : null}
                    {showWorkspacePdfTab ? (
                      <button
                        type="button"
                        aria-pressed={workspaceDashPanel === "pdf"}
                        onMouseEnter={() => setWorkspaceGuideHoverKey("dh_pdf")}
                        onFocus={() => setWorkspaceGuideHoverKey("dh_pdf")}
                        onClick={() => toggleWorkspacePanel("pdf")}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                          workspaceDashPanel === "pdf"
                            ? "border-emerald-600 bg-emerald-100 text-emerald-950"
                            : "border-emerald-200 bg-emerald-50/60 text-zinc-800 hover:bg-emerald-100"
                        }`}
                      >
                        <FileImage className={ICON_INLINE} aria-hidden />
                        {t("dash.panelPdfLetterhead")}
                      </button>
                    ) : null}
                    {showWorkspaceDownloadsTab && !deptHeadOnlyWorkspace ? (
                      <Link
                        href={`/reports/${encodeURIComponent(primaryMembership.tenantId)}?panel=downloads`}
                        className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-emerald-100"
                      >
                        <Download className={ICON_INLINE} aria-hidden />
                        {t("tenant.panelDownloads")}
                      </Link>
                    ) : null}
                    {workspaceDashPanel ? (
                      <span className="inline-flex shrink-0 items-center font-bold text-emerald-900" aria-hidden>
                        <ArrowDown className="h-9 w-9" strokeWidth={2.75} />
                      </span>
                    ) : null}
                  </nav>
                  <DashboardStagedGuide
                    mode="department_head"
                    activeStageKey={workspaceGuideHoverKey ?? undefined}
                    showTabs={false}
                  />
            </div>
          ) : null}

          {usesTeacherWorkspaceMenu && primaryMembership ? (
            <div className="mt-5 border-t border-emerald-100 pt-5">
              <div
                className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/90 via-white to-white p-4 shadow-sm ring-1 ring-emerald-100/90 sm:p-5"
                onMouseLeave={() => setTeacherGuideHoverKey(null)}
              >
                <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
                  <FolderKanban className={ICON_INLINE} aria-hidden />
                  {t("dash.teacherShowSelectionTitle")}
                </h2>
                <p className="mt-1 text-sm text-zinc-600">{t("tenant.sectionMenuHint")}</p>
                <nav
                  className="mt-4 flex flex-wrap items-center gap-2"
                  aria-label={t("dash.teacherShowSelectionTitle")}
                >
                  <button
                    type="button"
                    aria-pressed={teacherWorkspacePanel === "profile"}
                    onMouseEnter={() => setTeacherGuideHoverKey("teacher_profile")}
                    onFocus={() => setTeacherGuideHoverKey("teacher_profile")}
                    onClick={() => toggleTeacherWorkspacePanel("profile")}
                    className={teacherMenuButtonClass("profile")}
                  >
                    <UserRound className={ICON_INLINE} aria-hidden />
                    {t("dash.profileButton")}
                  </button>
                  <button
                    type="button"
                    aria-pressed={teacherWorkspacePanel === "classes"}
                    onMouseEnter={() => setTeacherGuideHoverKey("teacher_classes_reports")}
                    onFocus={() => setTeacherGuideHoverKey("teacher_classes_reports")}
                    onClick={() => toggleTeacherWorkspacePanel("classes")}
                    className={teacherMenuButtonClass("classes")}
                  >
                    <Library className={ICON_INLINE} aria-hidden />
                    {t("dash.reportsClasses")}
                  </button>
                  <button
                    type="button"
                    aria-pressed={teacherWorkspacePanel === "downloads"}
                    onMouseEnter={() => setTeacherGuideHoverKey("teacher_downloads")}
                    onFocus={() => setTeacherGuideHoverKey("teacher_downloads")}
                    onClick={() => toggleTeacherWorkspacePanel("downloads")}
                    className={teacherMenuButtonClass("downloads")}
                  >
                    <Download className={ICON_INLINE} aria-hidden />
                    {t("tenant.panelDownloads")}
                  </button>
                  {teacherMemberships.map((m) => (
                    <button
                      key={m.tenantId}
                      type="button"
                      onClick={() =>
                        openPdfForPrint(
                          `/api/tenants/${encodeURIComponent(m.tenantId)}/teacher/registers-pdf?lang=${encodeURIComponent(uiLang)}`,
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-600 bg-emerald-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
                    >
                      <NotebookText className={ICON_INLINE} aria-hidden />
                      {teacherMemberships.length > 1 ? `${m.tenantName} — ` : null}
                      {t("dash.teacherDownloadsPrintMyRegisters")}
                    </button>
                  ))}
                  {teacherWorkspacePanel ? (
                    <span className="inline-flex shrink-0 items-center font-bold text-emerald-900" aria-hidden>
                      <ArrowDown className="h-9 w-9" strokeWidth={2.75} />
                    </span>
                  ) : null}
                </nav>
                <DashboardStagedGuide
                  mode="teacher"
                  activeStageKey={teacherGuideHoverKey ?? undefined}
                  showTabs={false}
                />
                {teacherWorkspacePanel === "profile" ? (
                  <ProfileEditor
                    key="teacher-profile"
                    embedded
                    userDisplayName={userDisplayName}
                    membershipRoles={memberships.map((m) => m.role)}
                  />
                ) : null}
                {teacherWorkspacePanel === "classes" && primaryMembership ? (
                  <div id="dash-teacher-panel-classes" className="mt-4 border-t border-emerald-100 pt-4">
                    <TenantClassesPanel
                      key={`${primaryMembership.tenantId}-classes`}
                      tenantId={primaryMembership.tenantId}
                      viewerRole="teacher"
                      active
                      view="classes"
                    />
                  </div>
                ) : null}
                {teacherWorkspacePanel === "downloads" && primaryMembership ? (
                  <TeacherDownloadsCard
                    key="teacher-downloads"
                    tenantId={primaryMembership.tenantId}
                    isTeacher={primaryMembership.role === "teacher"}
                    embedded
                  />
                ) : null}
              </div>
            </div>
          ) : null}

        </section>
        )}

        {hasOwner && ownerFocusTenantId && primaryMembership ? (
          <>
            <div className="mb-3">
              <button
                type="button"
                onClick={() => {
                  userClearedSchoolFocus.current = true;
                  setOwnerFocusTenantId(null);
                  setWorkspaceDashPanel(null);
                  setWorkspaceGuideHoverKey(null);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-emerald-50/80"
              >
                <ArrowLeft className={ICON_INLINE} aria-hidden />
                {t("dash.ownerBackToSchools")}
              </button>
            </div>
            <section
              className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm"
              onMouseLeave={() => setWorkspaceGuideHoverKey(null)}
            >
            <h2 className="sr-only">{t("dash.schoolWorkspaceMenuTitle")}</h2>
            <p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm font-medium text-emerald-950">
              {t("dash.ownerViewingSchool", { name: primaryMembership.tenantName })}
            </p>
            <nav
              className="flex flex-wrap gap-2"
              aria-label={t("dash.schoolWorkspaceMenuTitle")}
            >
                <button
                  type="button"
                  aria-pressed={workspaceDashPanel === "overview"}
                  onMouseEnter={() => setWorkspaceGuideHoverKey("owner_overview")}
                  onFocus={() => setWorkspaceGuideHoverKey("owner_overview")}
                  onClick={() => toggleWorkspacePanel("overview")}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    workspaceDashPanel === "overview"
                      ? "border-emerald-600 bg-emerald-100 text-emerald-950"
                      : "border-emerald-200 bg-emerald-50/60 text-zinc-800 hover:bg-emerald-100"
                  }`}
                >
                  <LayoutList className={ICON_INLINE} aria-hidden />
                  {t("dash.panelOverview")}
                </button>
                {showWorkspacePdfTab ? (
                  <button
                    type="button"
                    aria-pressed={workspaceDashPanel === "pdf"}
                    onMouseEnter={() => setWorkspaceGuideHoverKey("owner_pdf")}
                    onFocus={() => setWorkspaceGuideHoverKey("owner_pdf")}
                    onClick={() => toggleWorkspacePanel("pdf")}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      workspaceDashPanel === "pdf"
                        ? "border-emerald-600 bg-emerald-100 text-emerald-950"
                        : "border-emerald-200 bg-emerald-50/60 text-zinc-800 hover:bg-emerald-100"
                    }`}
                  >
                    <FileImage className={ICON_INLINE} aria-hidden />
                    {t("dash.panelPdfLetterhead")}
                  </button>
                ) : null}
                {showWorkspaceInvitesTab ? (
                  <button
                    type="button"
                    aria-pressed={workspaceDashPanel === "invites"}
                    onMouseEnter={() => setWorkspaceGuideHoverKey("owner_invite")}
                    onFocus={() => setWorkspaceGuideHoverKey("owner_invite")}
                    onClick={() => toggleWorkspacePanel("invites")}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      workspaceDashPanel === "invites"
                        ? "border-emerald-600 bg-emerald-100 text-emerald-950"
                        : "border-emerald-200 bg-emerald-50/60 text-zinc-800 hover:bg-emerald-100"
                    }`}
                  >
                    <UserPlus className={ICON_INLINE} aria-hidden />
                    {t("dash.panelInviteTeam")}
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-pressed={workspaceDashPanel === "subjects"}
                  onMouseEnter={() => setWorkspaceGuideHoverKey("owner_subjects")}
                  onFocus={() => setWorkspaceGuideHoverKey("owner_subjects")}
                  onClick={() => toggleWorkspacePanel("subjects")}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    workspaceDashPanel === "subjects"
                      ? "border-emerald-600 bg-emerald-100 text-emerald-950"
                      : "border-emerald-200 bg-emerald-50/60 text-zinc-800 hover:bg-emerald-100"
                  }`}
                >
                  <Library className={ICON_INLINE} aria-hidden />
                  {t("tenant.panelSubjects")}
                </button>
                <button
                  type="button"
                  aria-pressed={workspaceDashPanel === "classes"}
                  onMouseEnter={() => setWorkspaceGuideHoverKey("owner_classes")}
                  onFocus={() => setWorkspaceGuideHoverKey("owner_classes")}
                  onClick={() => toggleWorkspacePanel("classes")}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    workspaceDashPanel === "classes"
                      ? "border-emerald-600 bg-emerald-100 text-emerald-950"
                      : "border-emerald-200 bg-emerald-50/60 text-zinc-800 hover:bg-emerald-100"
                  }`}
                >
                  <BookOpen className={ICON_INLINE} aria-hidden />
                  {t("tenant.panelClasses")}
                </button>
                <button
                  type="button"
                  aria-pressed={workspaceDashPanel === "timetable"}
                  onMouseEnter={() => setWorkspaceGuideHoverKey("owner_timetable")}
                  onFocus={() => setWorkspaceGuideHoverKey("owner_timetable")}
                  onClick={() => toggleWorkspacePanel("timetable")}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    workspaceDashPanel === "timetable"
                      ? "border-emerald-600 bg-emerald-100 text-emerald-950"
                      : "border-emerald-200 bg-emerald-50/60 text-zinc-800 hover:bg-emerald-100"
                  }`}
                >
                  <CalendarDays className={ICON_INLINE} aria-hidden />
                  {t("tenant.panelTimetable")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    openPdfForPrint(
                      `/api/tenants/${encodeURIComponent(primaryMembership.tenantId)}/school/registers-pdf?lang=${encodeURIComponent(uiLang)}`,
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-emerald-100"
                >
                  <Printer className={ICON_INLINE} aria-hidden />
                  {t("dash.ownerAllRegisterLists")}
                </button>
                {workspaceDashPanel ? (
                  <span className="inline-flex shrink-0 items-center font-bold text-emerald-900" aria-hidden>
                    <ArrowDown className="h-9 w-9" strokeWidth={2.75} />
                  </span>
                ) : null}
            </nav>
            <DashboardStagedGuide
              mode="owner_workspace"
              activeStageKey={workspaceGuideHoverKey ?? undefined}
              showTabs={false}
            />
          </section>
          </>
        ) : null}

        {hasOwner && memberships.length > 0 && !ownerFocusTenantId ? (
          <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
            <button
              type="button"
              onClick={() => {
                setAgentStartupOpen((o) => {
                  const next = !o;
                  if (next) void refreshMyAgent();
                  return next;
                });
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-700 bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
            >
              {agentStartupOpen ? (
                <X className={ICON_INLINE} aria-hidden />
              ) : (
                <Share2 className={ICON_INLINE} aria-hidden />
              )}
              {agentStartupOpen ? t("dash.agentCardClose") : t("dash.beAnAgent")}
            </button>

            {agentStartupOpen ? (
              <div
                id="dash-agent-expanded"
                className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                      <Share2 className={ICON_INLINE} aria-hidden />
                      {t("dash.agentSectionTitle")}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-600">
                      {stripePaymentsEnabled ? t("dash.agentSectionLead") : t("dash.agentSectionLeadPaymentsPaused")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void refreshMyAgent()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-100"
                  >
                    <RefreshCw className={`${ICON_INLINE} ${myAgentBusy ? "animate-spin" : ""}`} aria-hidden />
                    {myAgentBusy ? t("dash.agentRefreshing") : t("dash.agentRefresh")}
                  </button>
                </div>

                <p className="mt-3 rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2 text-xs leading-relaxed text-zinc-700">
                  {stripePaymentsEnabled ? t("dash.agentPaymentsBlurb") : t("dash.agentPaymentsBlurbPaused")}
                </p>

                {myAgentErr ? <div className="mt-3 text-sm text-red-700">{myAgentErr}</div> : null}

                {myAgent ? (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border border-emerald-200 bg-white p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        {t("dash.agentLinkLabel")}
                      </div>
                      <div className="mt-1 font-mono text-sm text-zinc-900">{`/landing.html?ref=${myAgent.code}`}</div>
                      <div className="mt-1 text-xs text-zinc-600">{t("dash.agentLinkShareHint")}</div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="text-sm text-zinc-600 sm:col-span-1">
                        <span className="font-semibold text-zinc-800">{t("dash.agentCommissionLabel")}</span>{" "}
                        {`${(((Number(myAgent.commission_bps ?? 0) || 0) / 100) as number).toFixed(2)}%`}
                      </div>
                      <div />

                      <label className="block min-w-0 text-sm sm:col-span-2">
                        <span className="mb-1 block text-zinc-600">
                          {stripePaymentsEnabled ? t("dash.agentStripeLabel") : t("dash.agentPayoutIdPausedLabel")}
                        </span>
                        {stripePaymentsEnabled ? (
                          <input
                            value={String((myAgentEdit.payout_stripe_account_id ?? myAgent.payout_stripe_account_id) ?? "")}
                            onChange={(e) =>
                              setMyAgentEdit((p) => ({ ...p, payout_stripe_account_id: e.target.value }))
                            }
                            className="block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-mono"
                            placeholder="acct_..."
                          />
                        ) : (
                          <p className="mt-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                            {t("dash.agentPayoutPausedHint")}
                          </p>
                        )}
                      </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={myAgentSaving}
                        onClick={() =>
                          void (async () => {
                            setMyAgentSaving(true);
                            try {
                              const res = await fetch("/api/agent-link/me", {
                                method: "PATCH",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify(myAgentEdit),
                              });
                              const data = await res.json().catch(() => ({}));
                              if (!res.ok) throw new Error(data.error || t("common.failed"));
                              setMyAgent((data.agent ?? null) as MyAgentLink | null);
                              setMyAgentEdit({});
                            } catch (e: unknown) {
                              alert(e instanceof Error ? e.message : t("common.failed"));
                            } finally {
                              setMyAgentSaving(false);
                            }
                          })()
                        }
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        <Save className={ICON_INLINE} aria-hidden />
                        {myAgentSaving ? t("dash.agentSaving") : t("dash.agentSave")}
                      </button>
                      <button
                        type="button"
                        disabled={myAgentSaving}
                        onClick={() => setMyAgentEdit({})}
                        className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-50"
                      >
                        <RotateCcw className={ICON_INLINE} aria-hidden />
                        {t("dash.agentReset")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-zinc-600">{myAgentBusy ? t("dash.agentLoading") : "—"}</div>
                )}
              </div>
            ) : null}
          </section>
        ) : null}

        {loadError ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle className={ICON_INLINE} aria-hidden />
              {t("dash.loadOrgsError")}
            </p>
            <p className="mt-2 font-mono text-xs">{loadError}</p>
          </section>
        ) : memberships.length === 0 ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 text-sm text-emerald-950">
            <p className="flex items-center gap-2 font-medium">
              <Building2 className={ICON_INLINE} aria-hidden />
              {t("dash.noSchoolTitle")}
            </p>
            <p className="mt-2 text-emerald-900/90">{t("dash.noSchoolBody")}</p>
          </section>
        ) : (
          <>
            {hasDeptHead && !hasOwner && !usesSchoolWorkspaceMenu ? (
              <section className="rounded-2xl border border-teal-200 bg-teal-50/80 p-5 shadow-sm">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-teal-950">
                  <Briefcase className={ICON_INLINE} aria-hidden />
                  {t("dash.dhBlurbTitle")}
                </h2>
                <p className="mt-2 text-sm text-teal-900/90">{t("dash.dhBlurbBody")}</p>
              </section>
            ) : null}
            {usesSchoolWorkspaceMenu ? (
              <>
                {workspaceDashPanel === "overview" && primaryMembership ? (
                  <section
                    id="dash-workspace-panel-overview"
                    className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm"
                  >
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
                      <Building2 className={ICON_INLINE} aria-hidden />
                      {primaryMembership.tenantName}
                    </h2>
                    <p className="mt-0.5 text-xs text-zinc-500">{roleDescription(primaryMembership.role)}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50/70 px-3 py-1 text-xs font-semibold text-zinc-800">
                        {roleLabel(primaryMembership.role)}
                      </span>
                      {primaryMembership.role === "owner" ? null : (
                        <Link
                          href={`/reports/${primaryMembership.tenantId}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
                        >
                          <Library className={`${ICON_INLINE} opacity-90`} aria-hidden />
                          {t("dash.reportsClasses")}
                        </Link>
                      )}
                    </div>
                    {primaryMembership.role === "owner" && ownerReportCredits !== null ? (
                      <div className="mt-4 rounded-xl border border-teal-300 bg-teal-50/80 px-4 py-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-teal-900">
                          {t("dash.ownerCreditsRemaining", { n: ownerReportCredits })}
                        </div>
                      </div>
                    ) : null}

                    <OverviewDataPrivacySection />

                    <div className="mt-4">
                      <DashboardTenantLanguage
                        embedded
                        tenants={[
                          {
                            tenantId: primaryMembership.tenantId,
                            tenantName: primaryMembership.tenantName,
                            canEditSettings:
                              primaryMembership.role === "owner" || primaryMembership.role === "department_head",
                          },
                        ]}
                        langs={reportLangByTenant}
                        onLanguageSaved={(tenantId, code) =>
                          setReportLangByTenant((prev) => ({ ...prev, [tenantId]: code }))
                        }
                      />
                    </div>

                    {primaryMembership.role === "owner" ? (
                      <DashboardScholasticArchivesOverview tenantId={primaryMembership.tenantId} />
                    ) : null}

                    {menuOverviewSummary ? (
                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2">
                          <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                            <Users className={`${ICON_INLINE} h-3 w-3 shrink-0 opacity-80`} aria-hidden />
                            {t("dash.statTeachers")}
                          </div>
                          <div className="mt-0.5 text-sm font-semibold text-zinc-900">{menuOverviewSummary.teachers}</div>
                        </div>
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2">
                          <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                            <BookOpen className={`${ICON_INLINE} h-3 w-3 shrink-0 opacity-80`} aria-hidden />
                            {t("dash.statClasses")}
                          </div>
                          <div className="mt-0.5 text-sm font-semibold text-zinc-900">{menuOverviewSummary.classes}</div>
                        </div>
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2">
                          <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                            <UserRound className={`${ICON_INLINE} h-3 w-3 shrink-0 opacity-80`} aria-hidden />
                            {t("dash.statStudents")}
                          </div>
                          <div className="mt-0.5 text-sm font-semibold text-zinc-900">{menuOverviewSummary.students}</div>
                        </div>
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2">
                          <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                            <FileCheck className={`${ICON_INLINE} h-3 w-3 shrink-0 opacity-80`} aria-hidden />
                            {t("dash.statReportsRendered")}
                          </div>
                          <div className="mt-0.5 text-sm font-semibold text-zinc-900">{menuOverviewSummary.reportsRendered}</div>
                        </div>
                      </div>
                    ) : null}

                    {primaryMembership.role === "department_head" || primaryMembership.role === "teacher" ? (
                      <div className="mt-4">
                        <DashboardTimetableSnippet
                          tenantId={primaryMembership.tenantId}
                          role={primaryMembership.role}
                          onOpenTimetable={
                            primaryMembership.role === "department_head" ? () => setWorkspaceDashPanel("timetable") : undefined
                          }
                        />
                      </div>
                    ) : null}

                    {primaryMembership.role === "owner" ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <a
                          href={`/api/tenants/${encodeURIComponent(primaryMembership.tenantId)}/export`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-emerald-100"
                        >
                          <FileSpreadsheet className={`${ICON_INLINE} opacity-90`} aria-hidden />
                          {t("dash.downloadSchoolDataExcel")}
                        </a>
                      </div>
                    ) : null}

                    {(() => {
                      const roster = rosterByTenant[primaryMembership.tenantId] ?? [];
                      const showRoster =
                        primaryMembership.role === "owner" || primaryMembership.role === "department_head";
                      const teacherStats = teacherStatsByTenant[primaryMembership.tenantId] ?? [];
                      return showRoster && roster.length > 0 ? (
                        <div className="mt-4 border-t border-emerald-100 pt-3">
                          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                            <ClipboardList className={`${ICON_INLINE} h-3.5 w-3.5 shrink-0 opacity-80`} aria-hidden />
                            {t("dash.teamRoster")}
                          </h3>
                          <div className="mt-2 overflow-x-auto">
                            <DashboardRosterTable
                              tenantId={primaryMembership.tenantId}
                              viewerRole={primaryMembership.role}
                              viewerEmail={email}
                              roster={roster}
                              teacherStats={teacherStats}
                            />
                          </div>
                        </div>
                      ) : null;
                    })()}

                    {primaryMembership.role === "owner" ? (
                      <div className="mt-4">
                        <DeleteSchoolButton
                          tenantId={primaryMembership.tenantId}
                          schoolName={primaryMembership.tenantName}
                        />
                      </div>
                    ) : null}
                  </section>
                ) : null}

                {workspaceDashPanel === "pdf" && showWorkspacePdfTab ? (
                  <div id="dash-workspace-panel-pdf">
                    <DashboardTenantPdfLetterhead
                      tenants={visibleMemberships
                        .filter((m) => m.role === "owner")
                        .map((m) => ({ tenantId: m.tenantId, tenantName: m.tenantName }))}
                      reportLangByTenant={reportLangByTenant}
                    />
                  </div>
                ) : null}

                {workspaceDashPanel === "invites" && showWorkspaceInvitesTab ? (
                  <section id="dash-workspace-panel-invites" className="space-y-4">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                      <UserPlus className={ICON_INLINE} aria-hidden />
                      {t("dash.inviteTeam")}
                    </h2>
                    <p className="text-sm text-zinc-600">{t("dash.inviteTeamHint")}</p>
                    {visibleMemberships
                      .filter((m) => m.role === "owner")
                      .map((m) => (
                        <InviteTeamForm
                          key={`owner-${m.tenantId}`}
                          variant="owner"
                          tenantId={m.tenantId}
                          schoolName={m.tenantName}
                        />
                      ))}
                    {visibleMemberships
                      .filter((m) => m.role === "department_head")
                      .map((m) => (
                        <InviteTeamForm
                          key={`dh-${m.tenantId}`}
                          variant="department_head"
                          tenantId={m.tenantId}
                          schoolName={m.tenantName}
                        />
                      ))}
                  </section>
                ) : null}

                {primaryMembership &&
                workspaceDashPanel === "subjects" &&
                (primaryMembership.role === "owner" || primaryMembership.role === "department_head") ? (
                  <div id="dash-workspace-panel-subjects">
                    <TenantClassesPanel
                      key={`${primaryMembership.tenantId}-subjects`}
                      tenantId={primaryMembership.tenantId}
                      viewerRole={primaryMembership.role}
                      active={workspaceDashPanel === "subjects"}
                      view="subjects"
                    />
                  </div>
                ) : null}

                {primaryMembership &&
                workspaceDashPanel === "classes" &&
                (primaryMembership.role === "owner" || primaryMembership.role === "department_head") ? (
                  <div id="dash-workspace-panel-classes">
                    <TenantClassesPanel
                      key={`${primaryMembership.tenantId}-classes`}
                      tenantId={primaryMembership.tenantId}
                      viewerRole={primaryMembership.role}
                      active={workspaceDashPanel === "classes"}
                      view="classes"
                    />
                  </div>
                ) : null}

                {primaryMembership && workspaceDashPanel === "schoolType" && primaryMembership.role === "owner" ? (
                  <section
                    id="dash-workspace-panel-schoolType"
                    className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm"
                  >
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">{t("tenant.schoolTypeTitle")}</h2>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <select
                        value={schoolGradeRubricByTenant[primaryMembership.tenantId] ?? "language"}
                        onChange={(e) =>
                          void saveSchoolEducationType(
                            primaryMembership.tenantId,
                            parseGradeRubricProfile(e.target.value, "language"),
                          )
                        }
                        disabled={schoolTypeSaving}
                        className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-emerald-50 disabled:text-zinc-600"
                      >
                        {GRADE_RUBRIC_PROFILES.map((rp) => (
                          <option key={rp} value={rp}>
                            {gradeRubricProfileDisplayLabel(t, rp)}
                          </option>
                        ))}
                      </select>
                      {schoolTypeSaving ? <span className="text-xs text-zinc-500">{t("tenant.saving")}</span> : null}
                    </div>
                  </section>
                ) : null}

                {primaryMembership &&
                workspaceDashPanel === "timetable" &&
                (primaryMembership.role === "owner" || primaryMembership.role === "department_head") ? (
                  <div
                    id="dash-workspace-panel-timetable"
                    className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-5"
                  >
                    <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-900">
                      <CalendarDays className={ICON_SECTION} aria-hidden />
                      {t("timetable.title")}
                    </h2>
                    <TimetablePageClient
                      tenantId={primaryMembership.tenantId}
                      schoolName={primaryMembership.tenantName}
                      viewerRole={primaryMembership.role}
                      embedded
                    />
                  </div>
                ) : null}
              </>
            ) : null}

            {!usesSchoolWorkspaceMenu && !hasTeacherOnly ? (
              <>
                <DashboardTenantLanguage
                  tenants={visibleMemberships.map((m) => ({
                    tenantId: m.tenantId,
                    tenantName: m.tenantName,
                    canEditSettings: m.role === "owner" || m.role === "department_head",
                  }))}
                  langs={reportLangByTenant}
                  onLanguageSaved={(tenantId, code) =>
                    setReportLangByTenant((prev) => ({ ...prev, [tenantId]: code }))
                  }
                />

                {visibleMemberships.some((m) => m.role === "owner") ? (
                  <DashboardTenantPdfLetterhead
                    tenants={visibleMemberships
                      .filter((m) => m.role === "owner")
                      .map((m) => ({ tenantId: m.tenantId, tenantName: m.tenantName }))}
                    reportLangByTenant={reportLangByTenant}
                  />
                ) : null}

                {visibleMemberships.length > 0 ? (
                  <section>
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                      <Building2 className={ICON_INLINE} aria-hidden />
                      {t("dash.yourSchools")}
                    </h2>
                    <p className="mt-1 text-sm text-zinc-600">{t("dash.yourSchoolsHint")}</p>
                    <ul className="mt-4 space-y-3">
                      {visibleMemberships.map((m) => {
                        const roster = rosterByTenant[m.tenantId] ?? [];
                        const showRoster = m.role === "owner" || m.role === "department_head";
                        const summary = summaryByTenant[m.tenantId];
                        const teacherStats = teacherStatsByTenant[m.tenantId] ?? [];
                        return (
                          <li key={m.membershipId} className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <div className="flex items-center gap-2 font-semibold text-zinc-900">
                                  <Building2 className={`${ICON_INLINE} text-emerald-800/90`} aria-hidden />
                                  {m.tenantName}
                                </div>
                                <div className="mt-0.5 text-xs text-zinc-500">{roleDescription(m.role)}</div>
                              </div>
                              <div className="flex shrink-0 flex-wrap items-center gap-2">
                                <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50/70 px-3 py-1 text-xs font-semibold text-zinc-800">
                                  {roleLabel(m.role)}
                                </span>
                                <Link
                                  href={reportsClassesHref(m.tenantId, m.role)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
                                >
                                  <Library className={`${ICON_INLINE} opacity-90`} aria-hidden />
                                  {t("dash.reportsClasses")}
                                </Link>
                              </div>
                            </div>
                            {m.role === "owner" && summary ? (
                              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2">
                                  <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                    <Users className={`${ICON_INLINE} h-3 w-3 shrink-0 opacity-80`} aria-hidden />
                                    {t("dash.statTeachers")}
                                  </div>
                                  <div className="mt-0.5 text-sm font-semibold text-zinc-900">{summary.teachers}</div>
                                </div>
                                <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2">
                                  <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                    <BookOpen className={`${ICON_INLINE} h-3 w-3 shrink-0 opacity-80`} aria-hidden />
                                    {t("dash.statClasses")}
                                  </div>
                                  <div className="mt-0.5 text-sm font-semibold text-zinc-900">{summary.classes}</div>
                                </div>
                                <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2">
                                  <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                    <UserRound className={`${ICON_INLINE} h-3 w-3 shrink-0 opacity-80`} aria-hidden />
                                    {t("dash.statStudents")}
                                  </div>
                                  <div className="mt-0.5 text-sm font-semibold text-zinc-900">{summary.students}</div>
                                </div>
                                <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2">
                                  <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                    <FileCheck className={`${ICON_INLINE} h-3 w-3 shrink-0 opacity-80`} aria-hidden />
                                    {t("dash.statReportsRendered")}
                                  </div>
                                  <div className="mt-0.5 text-sm font-semibold text-zinc-900">{summary.reportsRendered}</div>
                                </div>
                              </div>
                            ) : null}
                            {m.role === "owner" || m.role === "department_head" || m.role === "teacher" ? (
                              <DashboardTimetableSnippet
                                tenantId={m.tenantId}
                                role={m.role}
                                onOpenTimetable={
                                  primaryMembership &&
                                  (m.role === "owner" || m.role === "department_head") &&
                                  m.tenantId === primaryMembership.tenantId
                                    ? () => setWorkspaceDashPanel("timetable")
                                    : undefined
                                }
                              />
                            ) : null}
                            {m.role === "owner" ? (
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <a
                                  href={`/api/tenants/${encodeURIComponent(m.tenantId)}/export`}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-emerald-100"
                                >
                                  <FileSpreadsheet className={`${ICON_INLINE} opacity-90`} aria-hidden />
                                  {t("dash.downloadSchoolDataExcel")}
                                </a>
                              </div>
                            ) : null}
                            {showRoster && roster.length > 0 ? (
                              <div className="mt-4 border-t border-emerald-100 pt-3">
                                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                  <ClipboardList className={`${ICON_INLINE} h-3.5 w-3.5 shrink-0 opacity-80`} aria-hidden />
                                  {t("dash.teamRoster")}
                                </h3>
                                <div className="mt-2 overflow-x-auto">
                                  <DashboardRosterTable
                                    tenantId={m.tenantId}
                                    viewerRole={m.role}
                                    viewerEmail={email}
                                    roster={roster}
                                    teacherStats={teacherStats}
                                  />
                                </div>
                              </div>
                            ) : null}
                            {m.role === "owner" ? <DeleteSchoolButton tenantId={m.tenantId} schoolName={m.tenantName} /> : null}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ) : null}

                {visibleMemberships.some((m) => m.role === "owner" || m.role === "department_head") ? (
                  <section className="space-y-4">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                      <UserPlus className={ICON_INLINE} aria-hidden />
                      {t("dash.inviteTeam")}
                    </h2>
                    <p className="text-sm text-zinc-600">{t("dash.inviteTeamHint")}</p>
                    {visibleMemberships
                      .filter((m) => m.role === "owner")
                      .map((m) => (
                        <InviteTeamForm
                          key={`owner-${m.tenantId}`}
                          variant="owner"
                          tenantId={m.tenantId}
                          schoolName={m.tenantName}
                        />
                      ))}
                    {visibleMemberships
                      .filter((m) => m.role === "department_head")
                      .map((m) => (
                        <InviteTeamForm
                          key={`dh-${m.tenantId}`}
                          variant="department_head"
                          tenantId={m.tenantId}
                          schoolName={m.tenantName}
                        />
                      ))}
                  </section>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
