"use client";

import {
  AlertTriangle,
  BookOpen,
  Briefcase,
  ArrowDown,
  Building2,
  ClipboardList,
  CreditCard,
  FileCheck,
  FileImage,
  FileSpreadsheet,
  GraduationCap,
  LayoutDashboard,
  LayoutList,
  Library,
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AddSchoolForm } from "@/components/dashboard/AddSchoolForm";
import { DashboardRosterTable } from "@/components/dashboard/DashboardRosterTable";
import { DashboardTenantLanguage } from "@/components/dashboard/DashboardTenantLanguage";
import { DashboardTenantPdfLetterhead } from "@/components/dashboard/DashboardTenantPdfLetterhead";
import { DashboardTimetableSnippet } from "@/components/dashboard/DashboardTimetableSnippet";
import { DeleteSchoolButton } from "@/components/dashboard/DeleteSchoolButton";
import { InviteTeamForm } from "@/components/dashboard/InviteTeamForm";
import { GlobeLanguageSwitcher } from "@/components/i18n/GlobeLanguageSwitcher";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { AppHeaderLogo, AppHeaderWordmark } from "@/components/layout/AppHeaderBrand";
import { ICON_INLINE } from "@/components/ui/iconSizes";
import type { MembershipWithTenant, RomRole, TenantMemberRow } from "@/lib/data/memberships";
import { isReportLanguageCode, type ReportLanguageCode } from "@/lib/i18n/reportLanguages";
import type { TeacherStats, TenantSummaryStats } from "@/lib/data/tenantDashboardStats";

type MyAgentLink = {
  code: string;
  agent_email: string;
  display_name: string | null;
  // Note: owners should not control commission/wait/active; those are SaaS-owner controls.
  commission_bps?: number;
  payout_stripe_account_id?: string | null;
};

type OwnerDashPanel = "overview" | "pdf" | "invites";

export type DashboardClientViewProps = {
  email: string;
  loadError: string | null;
  memberships: MembershipWithTenant[];
  rosterByTenant: Record<string, TenantMemberRow[]>;
  summaryByTenant: Record<string, TenantSummaryStats>;
  teacherStatsByTenant: Record<string, TeacherStats[]>;
  /** Shared pool for this signed-in email when they own at least one school. */
  ownerReportCredits: number | null;
  /** Billing checkout is per-URL; use first owned school for “buy credits”. */
  firstOwnerTenantId: string | null;
};

export function DashboardClientView({
  email,
  loadError,
  memberships,
  rosterByTenant,
  summaryByTenant,
  teacherStatsByTenant,
  ownerReportCredits,
  firstOwnerTenantId,
}: DashboardClientViewProps) {
  const { lang, t } = useUiLanguage();

  const hasOwner = memberships.some((m) => m.role === "owner");
  const hasDeptHead = memberships.some((m) => m.role === "department_head");
  const hasTeacherOnly = memberships.length > 0 && memberships.every((m) => m.role === "teacher");

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

  const [ownerFocusTenantId, setOwnerFocusTenantId] = useState<string | null>(null);
  const userClearedSchoolFocus = useRef(false);
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
    if (ownerFocusTenantId) setAgentStartupOpen(false);
  }, [ownerFocusTenantId]);

  const visibleMemberships = useMemo(() => {
    if (!hasOwner || memberships.length === 0) return memberships;
    if (!ownerFocusTenantId) return [];
    return memberships.filter((m) => m.tenantId === ownerFocusTenantId);
  }, [hasOwner, memberships, ownerFocusTenantId]);

  const ownerUsesSchoolMenu = hasOwner && visibleMemberships.length > 0;

  const primaryMembership = useMemo(() => {
    if (visibleMemberships.length === 0) return null;
    const rank: Record<RomRole, number> = { owner: 0, department_head: 1, teacher: 2 };
    let best = visibleMemberships[0];
    for (const m of visibleMemberships) {
      if (rank[m.role] < rank[best.role]) best = m;
    }
    return best;
  }, [visibleMemberships]);

  const [ownerDashPanel, setOwnerDashPanel] = useState<OwnerDashPanel | null>(null);

  useEffect(() => {
    setOwnerDashPanel(null);
  }, [ownerFocusTenantId]);

  const toggleOwnerDashPanel = useCallback((panel: OwnerDashPanel) => {
    setOwnerDashPanel((current) => (current === panel ? null : panel));
  }, []);

  const showOwnerPdfTab = visibleMemberships.some((m) => m.role === "owner");
  const showOwnerInvitesTab = visibleMemberships.some(
    (m) => m.role === "owner" || m.role === "department_head",
  );

  const menuOverviewSummary = useMemo(() => {
    if (!primaryMembership || primaryMembership.role !== "owner") return undefined;
    return summaryByTenant[primaryMembership.tenantId];
  }, [primaryMembership, summaryByTenant]);

  const refreshReportLangs = useCallback(async () => {
    const targets =
      !hasOwner || memberships.length === 0
        ? memberships
        : visibleMemberships.length > 0
          ? visibleMemberships
          : [];
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
      }),
    );
    setReportLangByTenant(next);
  }, [hasOwner, memberships, visibleMemberships]);

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
      if (!res.ok) throw new Error(data.error || "Failed");
      setMyAgent((data.agent ?? null) as MyAgentLink | null);
      setMyAgentEdit({});
    } catch (e: unknown) {
      setMyAgentErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setMyAgentBusy(false);
    }
  }, [hasOwner]);

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

  return (
    <div className="min-h-screen bg-emerald-50/80 text-zinc-950">
      <header className="border-b border-emerald-200/80 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-start gap-3">
            <AppHeaderLogo />
            <div>
              <AppHeaderWordmark />
            <p className="mt-2 text-xs font-medium uppercase tracking-wide text-zinc-500">{t("brand.subtitle")}</p>
            <h1 className="mt-1 flex items-center gap-2 text-lg font-semibold tracking-tight">
              <LayoutDashboard className={ICON_INLINE} aria-hidden />
              {t("dash.title")}
            </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <GlobeLanguageSwitcher />
            <Link
              href="/reports"
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
            >
              <Library className={ICON_INLINE} aria-hidden />
              {t("nav.reports")}
            </Link>
            <form action="/api/auth/sign-out" method="post">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm hover:bg-emerald-50/60"
              >
                <LogOut className={ICON_INLINE} aria-hidden />
                {t("nav.signOut")}
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-5 py-8">
        <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
          <h2 className="m-0 flex flex-wrap items-baseline gap-x-[3ch] gap-y-1 text-sm">
            <span className="inline-flex items-center gap-2 font-medium text-zinc-500">
              <UserRound className={ICON_INLINE} aria-hidden />
              {t("dash.signedInAs")}
            </span>
            <span className="min-w-0 break-all font-mono font-normal text-zinc-900">{email}</span>
          </h2>

          {hasOwner && memberships.length > 0 ? (
            <div className="mt-6 border-t border-emerald-100 pt-5">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
                  <Building2 className={ICON_INLINE} aria-hidden />
                  {t("dash.schoolFocusTitle")}
                </h2>
                <p className="mt-1 text-sm text-zinc-600">{t("dash.schoolFocusHint")}</p>
              </div>
              <ul className="mt-4 space-y-2" role="radiogroup" aria-label={t("dash.yourSchools")}>
                {uniqueSchools.map(([tenantId, tenantName]) => (
                  <li key={tenantId}>
                    <label
                      className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2.5 has-[:checked]:border-emerald-300 has-[:checked]:bg-emerald-50"
                      onClick={(e) => {
                        if (ownerFocusTenantId === tenantId) {
                          e.preventDefault();
                          userClearedSchoolFocus.current = true;
                          setOwnerFocusTenantId(null);
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
                        }}
                      />
                      <span className="min-w-0 flex-1 font-medium text-zinc-900">{tenantName}</span>
                      <Link
                        href={`/reports/${tenantId}`}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Library className={`${ICON_INLINE} opacity-90`} aria-hidden />
                        {t("dash.reportsClasses")}
                      </Link>
                    </label>
                  </li>
                ))}
              </ul>
              <AddSchoolForm embedded />
            </div>
          ) : null}

          {hasOwner && ownerReportCredits !== null ? (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-emerald-100 pt-5">
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

          {hasOwner && memberships.length > 0 && !ownerFocusTenantId ? (
            <div className="mt-6 border-t border-emerald-100 pt-5">
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
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                        <Share2 className={ICON_INLINE} aria-hidden />
                        {t("dash.agentSectionTitle")}
                      </h3>
                      <p className="mt-1 text-sm text-zinc-600">{t("dash.agentSectionLead")}</p>
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
                    {t("dash.agentPaymentsBlurb")}
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

                        <label className="text-sm sm:col-span-2">
                          <span className="text-zinc-600">{t("dash.agentStripeLabel")}</span>
                          <input
                            value={String((myAgentEdit.payout_stripe_account_id ?? myAgent.payout_stripe_account_id) ?? "")}
                            onChange={(e) =>
                              setMyAgentEdit((p) => ({ ...p, payout_stripe_account_id: e.target.value }))
                            }
                            className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-mono"
                            placeholder="acct_..."
                          />
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
                                if (!res.ok) throw new Error(data.error || "Failed");
                                setMyAgent((data.agent ?? null) as MyAgentLink | null);
                                setMyAgentEdit({});
                              } catch (e: unknown) {
                                alert(e instanceof Error ? e.message : "Failed");
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
            </div>
          ) : null}
        </section>

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
            {hasDeptHead && !hasOwner ? (
              <section className="rounded-2xl border border-teal-200 bg-teal-50/80 p-5 shadow-sm">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-teal-950">
                  <Briefcase className={ICON_INLINE} aria-hidden />
                  {t("dash.dhBlurbTitle")}
                </h2>
                <p className="mt-2 text-sm text-teal-900/90">{t("dash.dhBlurbBody")}</p>
              </section>
            ) : null}
            {hasTeacherOnly ? (
              <section className="rounded-2xl border border-green-200 bg-green-50/80 p-5 shadow-sm">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-green-950">
                  <GraduationCap className={ICON_INLINE} aria-hidden />
                  {t("dash.teacherBlurbTitle")}
                </h2>
                <p className="mt-2 text-sm text-green-900/90">{t("dash.teacherBlurbBody")}</p>
              </section>
            ) : null}

            {ownerUsesSchoolMenu ? (
              <>
                <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
                    <Building2 className={ICON_INLINE} aria-hidden />
                    {t("dash.schoolWorkspaceMenuTitle")}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-600">{t("dash.schoolWorkspaceMenuHint")}</p>
                  <nav className="mt-4 flex flex-wrap gap-2" aria-label={t("dash.schoolWorkspaceMenuTitle")}>
                    <button
                      type="button"
                      aria-pressed={ownerDashPanel === "overview"}
                      onClick={() => toggleOwnerDashPanel("overview")}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        ownerDashPanel === "overview"
                          ? "border-emerald-600 bg-emerald-100 text-emerald-950"
                          : "border-emerald-200 bg-emerald-50/60 text-zinc-800 hover:bg-emerald-100"
                      }`}
                    >
                      <LayoutList className={ICON_INLINE} aria-hidden />
                      {t("dash.panelOverview")}
                    </button>
                    {showOwnerPdfTab ? (
                      <button
                        type="button"
                        aria-pressed={ownerDashPanel === "pdf"}
                        onClick={() => toggleOwnerDashPanel("pdf")}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                          ownerDashPanel === "pdf"
                            ? "border-emerald-600 bg-emerald-100 text-emerald-950"
                            : "border-emerald-200 bg-emerald-50/60 text-zinc-800 hover:bg-emerald-100"
                        }`}
                      >
                        <FileImage className={ICON_INLINE} aria-hidden />
                        {t("dash.panelPdfLetterhead")}
                      </button>
                    ) : null}
                    {showOwnerInvitesTab ? (
                      <button
                        type="button"
                        aria-pressed={ownerDashPanel === "invites"}
                        onClick={() => toggleOwnerDashPanel("invites")}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                          ownerDashPanel === "invites"
                            ? "border-emerald-600 bg-emerald-100 text-emerald-950"
                            : "border-emerald-200 bg-emerald-50/60 text-zinc-800 hover:bg-emerald-100"
                        }`}
                      >
                        <UserPlus className={ICON_INLINE} aria-hidden />
                        {t("dash.panelInviteTeam")}
                      </button>
                    ) : null}
                    {ownerDashPanel ? (
                      <span className="inline-flex shrink-0 items-center font-bold text-emerald-900" aria-hidden>
                        <ArrowDown className="h-9 w-9" strokeWidth={2.75} />
                      </span>
                    ) : null}
                  </nav>
                </section>

                {ownerDashPanel === "overview" && primaryMembership ? (
                  <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
                      <Building2 className={ICON_INLINE} aria-hidden />
                      {primaryMembership.tenantName}
                    </h2>
                    <p className="mt-0.5 text-xs text-zinc-500">{roleDescription(primaryMembership.role)}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50/70 px-3 py-1 text-xs font-semibold text-zinc-800">
                        {roleLabel(primaryMembership.role)}
                      </span>
                      <Link
                        href={`/reports/${primaryMembership.tenantId}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
                      >
                        <Library className={`${ICON_INLINE} opacity-90`} aria-hidden />
                        {t("dash.reportsClasses")}
                      </Link>
                    </div>

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

                    {primaryMembership.role === "owner" ||
                    primaryMembership.role === "department_head" ||
                    primaryMembership.role === "teacher" ? (
                      <div className="mt-4">
                        <DashboardTimetableSnippet tenantId={primaryMembership.tenantId} role={primaryMembership.role} />
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

                {ownerDashPanel === "pdf" && showOwnerPdfTab ? (
                  <DashboardTenantPdfLetterhead
                    tenants={visibleMemberships
                      .filter((m) => m.role === "owner")
                      .map((m) => ({ tenantId: m.tenantId, tenantName: m.tenantName }))}
                    reportLangByTenant={reportLangByTenant}
                  />
                ) : null}

                {ownerDashPanel === "invites" && showOwnerInvitesTab ? (
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

            {!ownerUsesSchoolMenu ? (
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
                                  href={`/reports/${m.tenantId}`}
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
                              <DashboardTimetableSnippet tenantId={m.tenantId} role={m.role} />
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
