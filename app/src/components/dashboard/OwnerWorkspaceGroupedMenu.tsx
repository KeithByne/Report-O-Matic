"use client";

import {
  Archive,
  ArrowDown,
  BookOpen,
  CalendarDays,
  ChevronDown,
  FileImage,
  LayoutList,
  Library,
  Printer,
  SlidersHorizontal,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardStagedGuide } from "@/components/dashboard/DashboardStagedGuide";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { ICON_INLINE } from "@/components/ui/iconSizes";

export type OwnerWorkspacePanel =
  | "overview"
  | "pdf"
  | "invites"
  | "subjects"
  | "classes"
  | "activeStudents"
  | "inactiveStudents"
  | "timetable";

type OwnerMenuGroup = "setup" | "students";

type SetupItem = {
  panel: OwnerWorkspacePanel;
  labelKey: string;
  guideKey: string;
  Icon: typeof FileImage;
  show: boolean;
};

type StudentsItem = {
  panel?: OwnerWorkspacePanel;
  labelKey: string;
  guideKey: string;
  Icon: typeof UserCheck;
  action: "panel" | "registers";
};

const SETUP_PANELS = new Set<OwnerWorkspacePanel>(["pdf", "invites", "subjects", "timetable"]);
const STUDENTS_PANELS = new Set<OwnerWorkspacePanel>(["activeStudents", "classes", "inactiveStudents"]);

function subButtonClass(active: boolean) {
  return `inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
    active
      ? "border-emerald-600 bg-emerald-100 text-emerald-950"
      : "border-emerald-200 bg-white text-zinc-800 hover:bg-emerald-100/80"
  }`;
}

function primaryButtonClass(active: boolean) {
  return `inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
    active
      ? "border-emerald-600 bg-emerald-100 text-emerald-950"
      : "border-emerald-200 bg-emerald-50/60 text-zinc-800 hover:bg-emerald-100"
  }`;
}

export function OwnerWorkspaceGroupedMenu({
  workspaceDashPanel,
  registersPreviewActive,
  showWorkspacePdfTab,
  showWorkspaceInvitesTab,
  showPanelArrow,
  onOpenPanel,
  onOpenOverview,
  onOpenRegisters,
  guideHoverKey,
  onGuideHover,
}: {
  workspaceDashPanel: OwnerWorkspacePanel | null;
  registersPreviewActive: boolean;
  showWorkspacePdfTab: boolean;
  showWorkspaceInvitesTab: boolean;
  showPanelArrow: boolean;
  onOpenPanel: (panel: OwnerWorkspacePanel) => void;
  onOpenOverview: () => void;
  onOpenRegisters: () => void;
  guideHoverKey: string | null;
  onGuideHover: (key: string | null) => void;
}) {
  const { t } = useUiLanguage();
  const [menuGroup, setMenuGroup] = useState<OwnerMenuGroup | null>(null);

  const defaultSetupPanel = useCallback((): OwnerWorkspacePanel => {
    if (showWorkspacePdfTab) return "pdf";
    if (showWorkspaceInvitesTab) return "invites";
    return "subjects";
  }, [showWorkspaceInvitesTab, showWorkspacePdfTab]);

  const setupItems = useMemo<SetupItem[]>(
    () => [
      {
        panel: "pdf",
        labelKey: "dash.panelPdfLetterhead",
        guideKey: "owner_pdf",
        Icon: FileImage,
        show: showWorkspacePdfTab,
      },
      {
        panel: "invites",
        labelKey: "dash.panelInviteTeam",
        guideKey: "owner_invite",
        Icon: UserPlus,
        show: showWorkspaceInvitesTab,
      },
      {
        panel: "subjects",
        labelKey: "tenant.panelSubjects",
        guideKey: "owner_subjects",
        Icon: Library,
        show: true,
      },
      {
        panel: "timetable",
        labelKey: "tenant.panelTimetable",
        guideKey: "owner_timetable",
        Icon: CalendarDays,
        show: true,
      },
    ],
    [showWorkspaceInvitesTab, showWorkspacePdfTab],
  );

  const studentsItems = useMemo<StudentsItem[]>(
    () => [
      {
        panel: "activeStudents",
        labelKey: "dash.panelActiveStudents",
        guideKey: "owner_active_students",
        Icon: UserCheck,
        action: "panel",
      },
      {
        panel: "classes",
        labelKey: "tenant.panelClasses",
        guideKey: "owner_classes",
        Icon: BookOpen,
        action: "panel",
      },
      {
        labelKey: "dash.ownerAllRegisterLists",
        guideKey: "owner_registers",
        Icon: Printer,
        action: "registers",
      },
      {
        panel: "inactiveStudents",
        labelKey: "dash.panelInactiveStudents",
        guideKey: "owner_inactive_students",
        Icon: Archive,
        action: "panel",
      },
    ],
    [],
  );

  useEffect(() => {
    if (registersPreviewActive) {
      setMenuGroup("students");
      return;
    }
    if (!workspaceDashPanel || workspaceDashPanel === "overview") {
      setMenuGroup(null);
      return;
    }
    if (SETUP_PANELS.has(workspaceDashPanel)) setMenuGroup("setup");
    else if (STUDENTS_PANELS.has(workspaceDashPanel)) setMenuGroup("students");
  }, [registersPreviewActive, workspaceDashPanel]);

  const openSetupGroup = () => {
    setMenuGroup("setup");
    onOpenPanel(defaultSetupPanel());
  };

  const openStudentsGroup = () => {
    setMenuGroup("students");
    onOpenPanel("activeStudents");
  };

  const openOverview = () => {
    setMenuGroup(null);
    onOpenOverview();
  };

  const overviewActive = workspaceDashPanel === "overview";
  const setupGroupActive = menuGroup === "setup" || (workspaceDashPanel !== null && SETUP_PANELS.has(workspaceDashPanel));
  const studentsGroupActive =
    menuGroup === "students" ||
    registersPreviewActive ||
    (workspaceDashPanel !== null && STUDENTS_PANELS.has(workspaceDashPanel));

  return (
    <>
      <nav className="flex flex-wrap items-center gap-2" aria-label={t("dash.schoolWorkspaceMenuTitle")}>
        <button
          type="button"
          aria-pressed={overviewActive}
          onMouseEnter={() => onGuideHover("owner_overview")}
          onFocus={() => onGuideHover("owner_overview")}
          onClick={openOverview}
          className={primaryButtonClass(overviewActive)}
        >
          <LayoutList className={ICON_INLINE} aria-hidden />
          {t("dash.panelOverview")}
        </button>
        <button
          type="button"
          aria-expanded={menuGroup === "setup"}
          aria-pressed={setupGroupActive && !overviewActive}
          onMouseEnter={() => onGuideHover("owner_pdf")}
          onFocus={() => onGuideHover("owner_pdf")}
          onClick={openSetupGroup}
          className={primaryButtonClass(setupGroupActive && !overviewActive)}
        >
          <SlidersHorizontal className={ICON_INLINE} aria-hidden />
          {t("dash.panelSetUp")}
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${menuGroup === "setup" ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
        <button
          type="button"
          aria-expanded={menuGroup === "students"}
          aria-pressed={studentsGroupActive && !overviewActive}
          onMouseEnter={() => onGuideHover("owner_active_students")}
          onFocus={() => onGuideHover("owner_active_students")}
          onClick={openStudentsGroup}
          className={primaryButtonClass(studentsGroupActive && !overviewActive)}
        >
          <Users className={ICON_INLINE} aria-hidden />
          {t("dash.panelStudents")}
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${menuGroup === "students" ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
        {showPanelArrow ? (
          <span className="inline-flex shrink-0 items-center font-bold text-emerald-900" aria-hidden>
            <ArrowDown className="h-9 w-9" strokeWidth={2.75} />
          </span>
        ) : null}
      </nav>

      {menuGroup === "setup" ? (
        <div
          id="dash-owner-menu-setup"
          role="group"
          aria-label={t("dash.panelSetUp")}
          className="mt-3 flex w-full flex-wrap gap-2 rounded-lg border border-emerald-100 bg-emerald-50/40 p-2"
        >
          {setupItems
            .filter((item) => item.show)
            .map(({ panel, labelKey, guideKey, Icon }) => (
              <button
                key={panel}
                type="button"
                aria-pressed={workspaceDashPanel === panel}
                onMouseEnter={() => onGuideHover(guideKey)}
                onFocus={() => onGuideHover(guideKey)}
                onClick={() => {
                  setMenuGroup("setup");
                  onOpenPanel(panel);
                }}
                className={subButtonClass(workspaceDashPanel === panel)}
              >
                <Icon className={ICON_INLINE} aria-hidden />
                {t(labelKey)}
              </button>
            ))}
        </div>
      ) : null}

      {menuGroup === "students" ? (
        <div
          id="dash-owner-menu-students"
          role="group"
          aria-label={t("dash.panelStudents")}
          className="mt-3 flex w-full flex-wrap gap-2 rounded-lg border border-emerald-100 bg-emerald-50/40 p-2"
        >
          {studentsItems.map((item) => {
            const active =
              item.action === "registers"
                ? registersPreviewActive
                : workspaceDashPanel === item.panel;
            return (
              <button
                key={item.labelKey}
                type="button"
                aria-pressed={active}
                onMouseEnter={() => onGuideHover(item.guideKey)}
                onFocus={() => onGuideHover(item.guideKey)}
                onClick={() => {
                  setMenuGroup("students");
                  if (item.action === "registers") onOpenRegisters();
                  else if (item.panel) onOpenPanel(item.panel);
                }}
                className={subButtonClass(active)}
              >
                <item.Icon className={ICON_INLINE} aria-hidden />
                {t(item.labelKey)}
              </button>
            );
          })}
        </div>
      ) : null}

      <DashboardStagedGuide
        mode="owner_workspace"
        activeStageKey={guideHoverKey ?? undefined}
        showTabs={false}
      />
    </>
  );
}
