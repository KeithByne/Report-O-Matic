"use client";

import {
  ArrowDown,
  BookOpen,
  CalendarDays,
  ChevronDown,
  FileImage,
  LayoutList,
  Library,
  SlidersHorizontal,
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
  | "pupils"
  /** @deprecated Mapped to pupils */
  | "activeStudents"
  /** @deprecated Mapped to pupils */
  | "findStudent"
  /** @deprecated Mapped to pupils */
  | "inactiveStudents"
  | "timetable";

export type SchoolWorkspaceMenuVariant = "owner" | "department_head";

type MenuGroup = "setup";

type SetupItem = {
  panel: SchoolWorkspacePanel;
  labelKey: string;
  guideKey: string;
  Icon: typeof FileImage;
  show: boolean;
};

const SETUP_PANELS = new Set<SchoolWorkspacePanel>(["pdf", "invites", "subjects", "timetable"]);
const PUPILS_PANELS = new Set<SchoolWorkspacePanel>([
  "pupils",
  "activeStudents",
  "findStudent",
  "inactiveStudents",
]);

const GUIDE_KEYS: Record<
  SchoolWorkspaceMenuVariant,
  {
    overview: string;
    pupils: string;
    classes: string;
    setupPrimary: string;
    pdf: string;
    invite: string;
    subjects: string;
    timetable: string;
  }
> = {
  owner: {
    overview: "owner_overview",
    pupils: "owner_pupils",
    classes: "owner_classes",
    setupPrimary: "owner_pdf",
    pdf: "owner_pdf",
    invite: "owner_invite",
    subjects: "owner_subjects",
    timetable: "owner_timetable",
  },
  department_head: {
    overview: "dh_overview",
    pupils: "dh_pupils",
    classes: "dh_classes",
    setupPrimary: "dh_invite",
    pdf: "dh_pdf",
    invite: "dh_invite",
    subjects: "dh_subjects",
    timetable: "dh_timetable",
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

function menuGroupForPanel(workspaceDashPanel: SchoolWorkspacePanel | null): MenuGroup | null {
  if (!workspaceDashPanel || workspaceDashPanel === "overview") return null;
  if (PUPILS_PANELS.has(workspaceDashPanel)) return null;
  if (workspaceDashPanel === "classes") return null;
  if (SETUP_PANELS.has(workspaceDashPanel)) return "setup";
  return null;
}

export function normalizeSchoolWorkspacePanel(
  panel: SchoolWorkspacePanel | null,
): SchoolWorkspacePanel | null {
  if (!panel) return null;
  if (panel === "activeStudents" || panel === "findStudent" || panel === "inactiveStudents") {
    return "pupils";
  }
  return panel;
}

export function SchoolWorkspaceGroupedMenu({
  variant,
  workspaceDashPanel,
  showWorkspacePdfTab,
  showWorkspaceInvitesTab,
  showPanelArrow,
  onOpenPanel,
  onOpenOverview,
  guideHoverKey,
  onGuideHover,
}: {
  variant: SchoolWorkspaceMenuVariant;
  workspaceDashPanel: SchoolWorkspacePanel | null;
  showWorkspacePdfTab: boolean;
  showWorkspaceInvitesTab: boolean;
  showPanelArrow: boolean;
  onOpenPanel: (panel: SchoolWorkspacePanel) => void;
  onOpenOverview: () => void;
  guideHoverKey: string | null;
  onGuideHover: (key: string | null) => void;
}) {
  const { t } = useUiLanguage();
  const [menuGroup, setMenuGroup] = useState<MenuGroup | null>(null);
  const guide = GUIDE_KEYS[variant];
  const guideMode: DashboardStagedGuideMode =
    variant === "owner" ? "owner_workspace" : "department_head";
  const menuIdPrefix = variant === "owner" ? "owner" : "dh";
  const normalizedPanel = normalizeSchoolWorkspacePanel(workspaceDashPanel);

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

  useEffect(() => {
    setMenuGroup(menuGroupForPanel(normalizedPanel));
  }, [normalizedPanel]);

  const openOverview = () => {
    setMenuGroup(null);
    onOpenOverview();
  };

  const openPupils = () => {
    setMenuGroup(null);
    onOpenPanel("pupils");
  };

  const openClasses = () => {
    setMenuGroup(null);
    onOpenPanel("classes");
  };

  const openSetupGroup = () => {
    setMenuGroup((current) => (current === "setup" ? null : "setup"));
  };

  const overviewActive = normalizedPanel === "overview";
  const pupilsActive = normalizedPanel === "pupils";
  const classesActive = normalizedPanel === "classes";
  const setupGroupActive =
    menuGroup === "setup" || (normalizedPanel !== null && SETUP_PANELS.has(normalizedPanel));

  return (
    <div className="min-w-0">
      <nav className="flex flex-wrap items-center gap-2" aria-label={t("dash.schoolWorkspaceMenuTitle")}>
        <button
          type="button"
          aria-pressed={overviewActive}
          onMouseEnter={() => onGuideHover(guide.overview)}
          onFocus={() => onGuideHover(guide.overview)}
          onClick={openOverview}
          className={primaryButtonClass(overviewActive)}
        >
          <LayoutList className={ICON_INLINE} aria-hidden />
          {t("dash.panelOverview")}
        </button>
        <button
          type="button"
          aria-pressed={pupilsActive}
          onMouseEnter={() => onGuideHover(guide.pupils)}
          onFocus={() => onGuideHover(guide.pupils)}
          onClick={openPupils}
          className={primaryButtonClass(pupilsActive)}
        >
          <Users className={ICON_INLINE} aria-hidden />
          {t("dash.panelPupils")}
        </button>
        <button
          type="button"
          aria-pressed={classesActive}
          onMouseEnter={() => onGuideHover(guide.classes)}
          onFocus={() => onGuideHover(guide.classes)}
          onClick={openClasses}
          className={primaryButtonClass(classesActive)}
        >
          <BookOpen className={ICON_INLINE} aria-hidden />
          {t("dash.panelClassesGroup")}
        </button>
        <button
          type="button"
          aria-expanded={menuGroup === "setup"}
          aria-haspopup="true"
          aria-controls={`dash-${menuIdPrefix}-menu-setup`}
          aria-pressed={setupGroupActive && !overviewActive && !pupilsActive && !classesActive}
          onMouseEnter={() => onGuideHover(guide.setupPrimary)}
          onFocus={() => onGuideHover(guide.setupPrimary)}
          onClick={openSetupGroup}
          className={primaryButtonClass(
            setupGroupActive && !overviewActive && !pupilsActive && !classesActive,
          )}
        >
          <SlidersHorizontal className={ICON_INLINE} aria-hidden />
          {t("dash.panelSetUp")}
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${menuGroup === "setup" ? "rotate-180" : ""}`}
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
                aria-pressed={normalizedPanel === panel}
                onMouseEnter={() => onGuideHover(guideKey)}
                onFocus={() => onGuideHover(guideKey)}
                onClick={() => {
                  setMenuGroup("setup");
                  onOpenPanel(panel);
                }}
                className={subButtonClass(normalizedPanel === panel)}
              >
                <Icon className={ICON_INLINE} aria-hidden />
                {t(labelKey)}
              </button>
            ))}
        </div>
      ) : null}

      <DashboardStagedGuide mode={guideMode} activeStageKey={guideHoverKey ?? undefined} showTabs={false} />
    </div>
  );
}

/** @deprecated Use {@link SchoolWorkspaceGroupedMenu} */
export const OwnerWorkspaceGroupedMenu = SchoolWorkspaceGroupedMenu;
export type OwnerWorkspacePanel = SchoolWorkspacePanel;
