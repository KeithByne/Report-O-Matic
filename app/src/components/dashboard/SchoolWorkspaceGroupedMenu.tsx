"use client";

import {
  ArrowDown,
  BookOpen,
  LayoutList,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import {
  DashboardStagedGuide,
  type DashboardStagedGuideMode,
} from "@/components/dashboard/DashboardStagedGuide";
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
  }
> = {
  owner: {
    overview: "owner_overview",
    pupils: "owner_pupils",
    classes: "owner_classes",
    setupPrimary: "owner_pdf",
  },
  department_head: {
    overview: "dh_overview",
    pupils: "dh_pupils",
    classes: "dh_classes",
    setupPrimary: "dh_invite",
  },
};

function primaryButtonClass(active: boolean) {
  return `inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
    active
      ? "border-emerald-600 bg-emerald-100 text-emerald-950"
      : "border-emerald-200 bg-emerald-50/60 text-zinc-800 hover:bg-emerald-100"
  }`;
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
  const guide = GUIDE_KEYS[variant];
  const guideMode: DashboardStagedGuideMode =
    variant === "owner" ? "owner_workspace" : "department_head";
  const normalizedPanel = normalizeSchoolWorkspacePanel(workspaceDashPanel);

  const openOverview = () => {
    onOpenOverview();
  };

  const openPupils = () => {
    onOpenPanel("pupils");
  };

  const openClasses = () => {
    onOpenPanel("classes");
  };

  const openSetup = () => {
    // Letterhead for owners; Invite for department heads (no letterhead tab).
    if (showWorkspacePdfTab) onOpenPanel("pdf");
    else if (showWorkspaceInvitesTab) onOpenPanel("invites");
    else onOpenPanel("subjects");
  };

  const overviewActive = normalizedPanel === "overview";
  const pupilsActive = normalizedPanel === "pupils";
  const classesActive = normalizedPanel === "classes";
  const setupActive =
    normalizedPanel !== null &&
    SETUP_PANELS.has(normalizedPanel) &&
    !overviewActive &&
    !pupilsActive &&
    !classesActive;

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
          aria-pressed={setupActive}
          onMouseEnter={() => onGuideHover(guide.setupPrimary)}
          onFocus={() => onGuideHover(guide.setupPrimary)}
          onClick={openSetup}
          className={primaryButtonClass(setupActive)}
        >
          <SlidersHorizontal className={ICON_INLINE} aria-hidden />
          {t("dash.panelSetUp")}
        </button>
        {showPanelArrow ? (
          <span className="inline-flex shrink-0 items-center font-bold text-emerald-900" aria-hidden>
            <ArrowDown className="h-9 w-9" strokeWidth={2.75} />
          </span>
        ) : null}
      </nav>

      <DashboardStagedGuide mode={guideMode} activeStageKey={guideHoverKey ?? undefined} showTabs={false} />
    </div>
  );
}

/** @deprecated Use {@link SchoolWorkspaceGroupedMenu} */
export const OwnerWorkspaceGroupedMenu = SchoolWorkspaceGroupedMenu;
export type OwnerWorkspacePanel = SchoolWorkspacePanel;
