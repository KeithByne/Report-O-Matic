"use client";

import { useEffect, useMemo, useState } from "react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";

export type DashboardStagedGuideMode = "owner_hub" | "owner_workspace" | "department_head" | "teacher";

export type StageDef = {
  key: string;
  n: number;
  titleKey: string;
  linesKeys: string[];
};

export function dashboardGuideStagesForMode(mode: DashboardStagedGuideMode): StageDef[] {
  if (mode === "owner_hub") {
    return [
      {
        key: "menu_profile",
        n: 0,
        titleKey: "dash.guide.teacherProfileTitle",
        linesKeys: ["dash.guide.teacherProfile1", "dash.guide.teacherProfile2", "dash.guide.teacherProfile3"],
      },
      {
        key: "owner_agent",
        n: 0,
        titleKey: "dash.guide.agentTitle",
        linesKeys: ["dash.guide.agent1", "dash.guide.agent2", "dash.guide.agent3"],
      },
      {
        key: "hub_add_school",
        n: 1,
        titleKey: "dash.guide.hubAddSchoolTitle",
        linesKeys: ["dash.guide.hubAddSchool1", "dash.guide.hubAddSchool2"],
      },
      {
        key: "hub_pick_school",
        n: 2,
        titleKey: "dash.guide.hubPickSchoolTitle",
        linesKeys: ["dash.guide.hubPickSchool1", "dash.guide.hubPickSchool2"],
      },
    ];
  }
  if (mode === "owner_workspace") {
    return [
      {
        key: "menu_profile",
        n: 0,
        titleKey: "dash.guide.teacherProfileTitle",
        linesKeys: ["dash.guide.teacherProfile1", "dash.guide.teacherProfile2", "dash.guide.teacherProfile3"],
      },
      {
        key: "owner_overview",
        n: 1,
        titleKey: "dash.guide.ownerMenuOverviewTitle",
        linesKeys: ["dash.guide.ownerMenuOverview1", "dash.guide.ownerMenuOverview2", "dash.guide.ownerMenuOverview3"],
      },
      {
        key: "owner_school_type",
        n: 2,
        titleKey: "dash.guide.ownerSchoolTypeTitle",
        linesKeys: ["dash.guide.ownerSchoolType1", "dash.guide.ownerSchoolType2", "dash.guide.ownerSchoolType3"],
      },
      {
        key: "owner_pdf",
        n: 3,
        titleKey: "dash.guide.stepLetterheadTitle",
        linesKeys: ["dash.guide.ownerLetterhead1", "dash.guide.ownerLetterhead2", "dash.guide.ownerLetterhead3"],
      },
      {
        key: "owner_invite",
        n: 4,
        titleKey: "dash.guide.stepInviteTitle",
        linesKeys: ["dash.guide.invite1", "dash.guide.invite2", "dash.guide.invite3"],
      },
      {
        key: "owner_subjects",
        n: 5,
        titleKey: "dash.guide.ownerSubjectsTitle",
        linesKeys: ["dash.guide.ownerSubjects1", "dash.guide.ownerSubjects2", "dash.guide.ownerSubjects3"],
      },
      {
        key: "owner_classes",
        n: 6,
        titleKey: "dash.guide.stepClassesTitle",
        linesKeys: ["dash.guide.classDh1", "dash.guide.classDh2", "dash.guide.classDh3"],
      },
      {
        key: "owner_active_students",
        n: 7,
        titleKey: "dash.guide.activeStudentsTitle",
        linesKeys: ["dash.guide.activeStudents1", "dash.guide.activeStudents2", "dash.guide.activeStudents3"],
      },
      {
        key: "owner_inactive_students",
        n: 8,
        titleKey: "dash.guide.inactiveStudentsTitle",
        linesKeys: ["dash.guide.inactiveStudents1", "dash.guide.inactiveStudents2", "dash.guide.inactiveStudents3"],
      },
      {
        key: "owner_timetable",
        n: 9,
        titleKey: "dash.guide.ownerTimetableTitle",
        linesKeys: ["dash.guide.ownerTimetable1", "dash.guide.ownerTimetable2", "dash.guide.ownerTimetable3"],
      },
      {
        key: "owner_registers",
        n: 10,
        titleKey: "dash.guide.registersTitle",
        linesKeys: ["dash.guide.registers1", "dash.guide.registers2", "dash.guide.registers3"],
      },
    ];
  }
  if (mode === "department_head") {
    return [
      {
        key: "menu_profile",
        n: 0,
        titleKey: "dash.guide.teacherProfileTitle",
        linesKeys: ["dash.guide.teacherProfile1", "dash.guide.teacherProfile2", "dash.guide.teacherProfile3"],
      },
      {
        key: "dh_overview",
        n: 1,
        titleKey: "dash.guide.ownerMenuOverviewTitle",
        linesKeys: ["dash.guide.dhOverview1", "dash.guide.dhOverview2", "dash.guide.dhOverview3"],
      },
      {
        key: "dh_invite",
        n: 2,
        titleKey: "dash.guide.stepInviteTitle",
        linesKeys: ["dash.guide.invite1", "dash.guide.invite2", "dash.guide.invite3"],
      },
      {
        key: "dh_subjects",
        n: 3,
        titleKey: "dash.guide.ownerSubjectsTitle",
        linesKeys: ["dash.guide.ownerSubjects1", "dash.guide.ownerSubjects2", "dash.guide.ownerSubjects3"],
      },
      {
        key: "dh_classes",
        n: 4,
        titleKey: "dash.guide.stepClassesTitle",
        linesKeys: ["dash.guide.classDh1", "dash.guide.classDh2", "dash.guide.classDh3"],
      },
      {
        key: "dh_active_students",
        n: 5,
        titleKey: "dash.guide.activeStudentsTitle",
        linesKeys: ["dash.guide.activeStudents1", "dash.guide.activeStudents2", "dash.guide.activeStudents3"],
      },
      {
        key: "dh_inactive_students",
        n: 6,
        titleKey: "dash.guide.inactiveStudentsTitle",
        linesKeys: ["dash.guide.inactiveStudents1", "dash.guide.inactiveStudents2", "dash.guide.inactiveStudents3"],
      },
      {
        key: "dh_timetable",
        n: 7,
        titleKey: "dash.guide.dhTimetableTitle",
        linesKeys: ["dash.guide.dhTimetable1", "dash.guide.dhTimetable2", "dash.guide.dhTimetable3"],
      },
      {
        key: "dh_registers",
        n: 8,
        titleKey: "dash.guide.registersTitle",
        linesKeys: ["dash.guide.registers1", "dash.guide.registers2", "dash.guide.registers3"],
      },
      {
        key: "dh_pdf",
        n: 9,
        titleKey: "dash.guide.stepLetterheadTitle",
        linesKeys: ["dash.guide.dhPdf1", "dash.guide.dhPdf2", "dash.guide.dhPdf3"],
      },
      {
        key: "dh_downloads",
        n: 10,
        titleKey: "dash.guide.menuDownloadsTitle",
        linesKeys: ["dash.guide.menuDownloads1", "dash.guide.menuDownloads2", "dash.guide.menuDownloads3"],
      },
    ];
  }
  return [
    {
      key: "teacher_profile",
      n: 1,
      titleKey: "dash.guide.teacherProfileTitle",
      linesKeys: ["dash.guide.teacherProfile1", "dash.guide.teacherProfile2", "dash.guide.teacherProfile3"],
    },
    {
      key: "teacher_classes_reports",
      n: 2,
      titleKey: "dash.guide.stepClassTeacherTitle",
      linesKeys: ["dash.guide.classT1", "dash.guide.classT2", "dash.guide.classT3"],
    },
    {
      key: "teacher_downloads",
      n: 3,
      titleKey: "dash.guide.teacherDownloadsTitle",
      linesKeys: ["dash.guide.teacherDownloads1", "dash.guide.teacherDownloads2", "dash.guide.teacherDownloads3"],
    },
    {
      key: "teacher_registers",
      n: 4,
      titleKey: "dash.guide.teacherRegistersTitle",
      linesKeys: ["dash.guide.teacherRegisters1", "dash.guide.teacherRegisters2", "dash.guide.teacherRegisters3"],
    },
    {
      key: "teacher_reports",
      n: 5,
      titleKey: "dash.guide.stepReportsTitle",
      linesKeys: ["dash.guide.report1", "dash.guide.report2", "dash.guide.report3"],
    },
  ];
}

export function DashboardStagedGuide({
  mode,
  activeStageKey: selectedStageKey,
  showTabs = true,
}: {
  mode: DashboardStagedGuideMode;
  activeStageKey?: string;
  showTabs?: boolean;
}) {
  const { t } = useUiLanguage();
  const stages = useMemo<StageDef[]>(() => dashboardGuideStagesForMode(mode), [mode]);
  const [internalActiveStageKey, setInternalActiveStageKey] = useState("");
  useEffect(() => {
    if (showTabs) return;
    setInternalActiveStageKey(selectedStageKey ?? "");
  }, [selectedStageKey, showTabs]);
  const activeStageKey = showTabs ? internalActiveStageKey : selectedStageKey;
  const activeStage = stages.find((s) => s.key === activeStageKey);
  const showTipList = Boolean(activeStage);

  return (
    <div
      className="mt-4 border-t border-emerald-100 pt-4 text-left"
      onMouseLeave={showTabs ? () => setInternalActiveStageKey("") : undefined}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-800/90">{t("dash.guide.title")}</h3>
      {showTipList ? (
        <div className="mt-2 rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
          {showTabs ? (
            <div className="flex flex-wrap gap-2">
              {stages.map((s) => {
                const active = s.key === activeStage?.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onMouseEnter={() => setInternalActiveStageKey(s.key)}
                    onFocus={() => setInternalActiveStageKey(s.key)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? "border-emerald-600 bg-emerald-100 text-emerald-950"
                        : "border-emerald-200 bg-white text-zinc-700 hover:bg-emerald-100/70"
                    }`}
                  >
                    {s.n}. {t(s.titleKey)}
                  </button>
                );
              })}
            </div>
          ) : null}
          {activeStage ? (
            <ol className={`ml-5 list-decimal space-y-1.5 text-left text-xs leading-relaxed text-zinc-600 ${showTabs ? "mt-3" : ""}`}>
              {activeStage.linesKeys.map((key) => (
                <li key={key}>{t(key)}</li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
