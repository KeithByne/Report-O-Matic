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
import { useEffect, useMemo, useState } from "react";
import {
  DashboardStagedGuide,
  type DashboardStagedGuideMode,
} from "@/components/dashboard/DashboardStagedGuide";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { ICON_INLINE } from "@/components/ui/iconSizes";

export type SchoolWorkspacePanel =
  | "overview"
  | "pdf"
  | "invites"
  | "subjects"
  | "classes"
  | "activeStudents"
  | "inactiveStudents"
  | "timetable";

export type SchoolWorkspaceMenuVariant = "owner" | "department_head";

type MenuGroup = "setup" | "students";

type SetupItem = {
  panel: SchoolWorkspacePanel;
  labelKey: string;
  guideKey: string;
  Icon: typeof FileImage;
  show: boolean;
};

type StudentsItem = {
  panel?: SchoolWorkspacePanel;
  labelKey: string;
  guideKey: string;
  Icon: typeof UserCheck;
  action: "panel" | "registers";
};

const SETUP_PANELS = new Set<SchoolWorkspacePanel>(["pdf", "invites", "subjects", "timetable"]);
const STUDENTS_PANELS = new Set<SchoolWorkspacePanel>(["activeStudents", "classes", "inactiveStudents"]);

const GUIDE_KEYS: Record<
  SchoolWorkspaceMenuVariant,
  {
    overview: string;
    setupPrimary: string;
    studentsPrimary: string;
    pdf: string;
    invite: string;
    subjects: string;
    timetable: string;
    activeStudents: string;
    classes: string;
    registers: string;
    inactiveStudents: string;
  }
> = {
  owner: {
    overview: "owner_overview",
    setupPrimary: "owner_pdf",
    studentsPrimary: "owner_active_students",
    pdf: "owner_pdf",
    invite: "owner_invite",
    subjects: "owner_subjects",
    timetable: "owner_timetable",
    activeStudents: "owner_active_students",
    classes: "owner_classes",
    registers: "owner_registers",
    inactiveStudents: "owner_inactive_students",
  },
  department_head: {
    overview: "dh_overview",
    setupPrimary: "dh_invite",
    studentsPrimary: "dh_active_students",
    pdf: "dh_pdf",
    invite: "dh_invite",
    subjects: "dh_subjects",
    timetable: "dh_timetable",
    activeStudents: "dh_active_students",
    classes: "dh_classes",
    registers: "dh_registers",
    inactiveStudents: "dh_inactive_students",
  },
};

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

function menuGroupForPanel(
  workspaceDashPanel: SchoolWorkspacePanel | null,
  registersPreviewActive: boolean,
): MenuGroup | null {
  if (registersPreviewActive) return "students";
  if (!workspaceDashPanel || workspaceDashPanel === "overview") return null;
  if (SETUP_PANELS.has(workspaceDashPanel)) return "setup";
  if (STUDENTS_PANELS.has(workspaceDashPanel)) return "students";
  return null;
}

export function SchoolWorkspaceGroupedMenu({
  variant,
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
  variant: SchoolWorkspaceMenuVariant;
  workspaceDashPanel: SchoolWorkspacePanel | null;
  registersPreviewActive: boolean;
  showWorkspacePdfTab: boolean;
  showWorkspaceInvitesTab: boolean;
  showPanelArrow: boolean;
  onOpenPanel: (panel: SchoolWorkspacePanel) => void;
  onOpenOverview: () => void;
  onOpenRegisters: () => void;
  guideHoverKey: string | null;
  onGuideHover: (key: string | null) => void;
}) {
  const { t } = useUiLanguage();
  const [menuGroup, setMenuGroup] = useState<MenuGroup | null>(null);
  const guide = GUIDE_KEYS[variant];
  const guideMode: DashboardStagedGuideMode =
    variant === "owner" ? "owner_workspace" : "department_head";
  const menuIdPrefix = variant === "owner" ? "owner" : "dh";

  const setupItems = useMemo<SetupItem[]>(
    () => [
      {
        panel: "pdf",
        labelKey: "dash.panelPdfLetterhead",
        guideKey: guide.pdf,
        Icon: FileImage,
        show: showWorkspacePdfTab,
      },
      {
        panel: "invites",
        labelKey: "dash.panelInviteTeam",
        guideKey: guide.invite,
        Icon: UserPlus,
        show: showWorkspaceInvitesTab,
      },
      {
        panel: "subjects",
        labelKey: "tenant.panelSubjects",
        guideKey: guide.subjects,
        Icon: Library,
        show: true,
      },
      {
        panel: "timetable",
        labelKey: "tenant.panelTimetable",
        guideKey: guide.timetable,
        Icon: CalendarDays,
        show: true,
      },
    ],
    [guide, showWorkspaceInvitesTab, showWorkspacePdfTab],
  );

  const studentsItems = useMemo<StudentsItem[]>(
    () => [
      {
        panel: "activeStudents",
        labelKey: "dash.panelActiveStudents",
        guideKey: guide.activeStudents,
        Icon: UserCheck,
        action: "panel",
      },
      {
        panel: "classes",
        labelKey: "tenant.panelClasses",
        guideKey: guide.classes,
        Icon: BookOpen,
        action: "panel",
      },
      {
        labelKey: "dash.ownerAllRegisterLists",
        guideKey: guide.registers,
        Icon: Printer,
        action: "registers",
      },
      {
        panel: "inactiveStudents",
        labelKey: "dash.panelInactiveStudents",
        guideKey: guide.inactiveStudents,
        Icon: Archive,
        action: "panel",
      },
    ],
    [guide],
  );

  useEffect(() => {
    setMenuGroup(menuGroupForPanel(workspaceDashPanel, registersPreviewActive));
  }, [registersPreviewActive, workspaceDashPanel]);

  const revealSetupGroup = () => setMenuGroup("setup");
  const revealStudentsGroup = () => setMenuGroup("students");

  const handleMenuMouseLeave = () => {
    const pinned = menuGroupForPanel(workspaceDashPanel, registersPreviewActive);
    setMenuGroup(pinned);
  };

  const openOverview = () => {
    setMenuGroup(null);
    onOpenOverview();
  };

  const overviewActive = workspaceDashPanel === "overview";
  const setupGroupActive =
    menuGroup === "setup" || (workspaceDashPanel !== null && SETUP_PANELS.has(workspaceDashPanel));
  const studentsGroupActive =
    menuGroup === "students" ||
    registersPreviewActive ||
    (workspaceDashPanel !== null && STUDENTS_PANELS.has(workspaceDashPanel));

  return (
    <div className="min-w-0" onMouseLeave={handleMenuMouseLeave}>
      <nav className="flex flex-wrap items-center gap-2" aria-label={t("dash.schoolWorkspaceMenuTitle")}>
        <button
          type="button"
          aria-pressed={overviewActive}
          onMouseEnter={() => {
            onGuideHover(guide.overview);
            setMenuGroup(null);
          }}
          onFocus={() => onGuideHover(guide.overview)}
          onClick={openOverview}
          className={primaryButtonClass(overviewActive)}
        >
          <LayoutList className={ICON_INLINE} aria-hidden />
          {t("dash.panelOverview")}
        </button>
        <button
          type="button"
          aria-expanded={menuGroup === "setup"}
          aria-haspopup="true"
          aria-controls={`dash-${menuIdPrefix}-menu-setup`}
          aria-pressed={setupGroupActive && !overviewActive}
          onMouseEnter={() => {
            revealSetupGroup();
            onGuideHover(guide.setupPrimary);
          }}
          onFocus={() => {
            revealSetupGroup();
            onGuideHover(guide.setupPrimary);
          }}
          onClick={revealSetupGroup}
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
          aria-haspopup="true"
          aria-controls={`dash-${menuIdPrefix}-menu-students`}
          aria-pressed={studentsGroupActive && !overviewActive}
          onMouseEnter={() => {
            revealStudentsGroup();
            onGuideHover(guide.studentsPrimary);
          }}
          onFocus={() => {
            revealStudentsGroup();
            onGuideHover(guide.studentsPrimary);
          }}
          onClick={revealStudentsGroup}
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
          id={`dash-${menuIdPrefix}-menu-setup`}
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
          id={`dash-${menuIdPrefix}-menu-students`}
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

      <DashboardStagedGuide mode={guideMode} activeStageKey={guideHoverKey ?? undefined} showTabs={false} />
    </div>
  );
}

/** @deprecated Use {@link SchoolWorkspaceGroupedMenu} */
export const OwnerWorkspaceGroupedMenu = SchoolWorkspaceGroupedMenu;
export type OwnerWorkspacePanel = SchoolWorkspacePanel;
