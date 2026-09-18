"use client";

import { CalendarDays, FileImage, Library, UserPlus } from "lucide-react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { ICON_INLINE } from "@/components/ui/iconSizes";
import type { SchoolWorkspacePanel } from "@/components/dashboard/SchoolWorkspaceGroupedMenu";

type SetupNavPanel = Extract<SchoolWorkspacePanel, "pdf" | "invites" | "subjects" | "timetable">;

function navButtonClass(active: boolean) {
  return `inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
    active
      ? "border-emerald-600 bg-emerald-100 text-emerald-950"
      : "border-emerald-200 bg-white text-zinc-800 hover:bg-emerald-100/80"
  }`;
}

/**
 * Sibling controls for school Set up: Letterhead hosts Invite / Subjects / Timetable;
 * other setup panels also show this strip (including Letterhead) so you can switch without the menu submenu.
 */
export function SchoolSetupSiblingNav({
  activePanel,
  showPdf,
  showInvites,
  onOpenPanel,
  onGuideHover,
  guideKeys,
}: {
  activePanel: SetupNavPanel;
  showPdf: boolean;
  showInvites: boolean;
  onOpenPanel: (panel: SetupNavPanel) => void;
  onGuideHover?: (key: string | null) => void;
  guideKeys?: {
    pdf?: string;
    invite?: string;
    subjects?: string;
    timetable?: string;
  };
}) {
  const { t } = useUiLanguage();
  const items: Array<{
    panel: SetupNavPanel;
    labelKey: string;
    guideKey?: string;
    Icon: typeof FileImage;
    show: boolean;
  }> = [
    {
      panel: "pdf",
      labelKey: "dash.panelPdfLetterhead",
      guideKey: guideKeys?.pdf,
      Icon: FileImage,
      show: showPdf && activePanel !== "pdf",
    },
    {
      panel: "invites",
      labelKey: "dash.panelInviteTeam",
      guideKey: guideKeys?.invite,
      Icon: UserPlus,
      show: showInvites,
    },
    {
      panel: "subjects",
      labelKey: "tenant.panelSubjects",
      guideKey: guideKeys?.subjects,
      Icon: Library,
      show: true,
    },
    {
      panel: "timetable",
      labelKey: "tenant.panelTimetable",
      guideKey: guideKeys?.timetable,
      Icon: CalendarDays,
      show: true,
    },
  ];

  const visible = items.filter((item) => item.show);
  if (visible.length === 0) return null;

  return (
    <div
      role="group"
      aria-label={t("dash.panelSetUp")}
      className="flex flex-wrap items-center gap-2"
    >
      {visible.map(({ panel, labelKey, guideKey, Icon }) => (
        <button
          key={panel}
          type="button"
          aria-pressed={activePanel === panel}
          onMouseEnter={() => guideKey && onGuideHover?.(guideKey)}
          onFocus={() => guideKey && onGuideHover?.(guideKey)}
          onClick={() => onOpenPanel(panel)}
          className={navButtonClass(activePanel === panel)}
        >
          <Icon className={ICON_INLINE} aria-hidden />
          {t(labelKey)}
        </button>
      ))}
    </div>
  );
}
