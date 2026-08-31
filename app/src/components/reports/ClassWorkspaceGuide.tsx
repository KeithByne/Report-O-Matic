"use client";

import { useEffect, useMemo, useState } from "react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import type { StageDef } from "@/components/dashboard/DashboardStagedGuide";
import type { RomRole } from "@/lib/data/memberships";

export function classWorkspaceGuideStages(viewerRole: RomRole): StageDef[] {
  const stages: StageDef[] = [
    {
      key: "class_settings",
      n: 1,
      titleKey: "class.guide.settingsTitle",
      linesKeys: ["class.guide.settings1", "class.guide.settings2", "class.guide.settings3"],
    },
    {
      key: "class_students",
      n: 2,
      titleKey: "class.guide.studentsTitle",
      linesKeys: ["class.guide.students1", "class.guide.students2", "class.guide.students3"],
    },
    {
      key: "class_bulk",
      n: 3,
      titleKey: "class.guide.bulkTitle",
      linesKeys: ["class.guide.bulk1", "class.guide.bulk2", "class.guide.bulk3"],
    },
  ];
  if (viewerRole === "owner" || viewerRole === "department_head") {
    stages.push({
      key: "class_move",
      n: 4,
      titleKey: "class.guide.moveTitle",
      linesKeys: ["class.guide.move1", "class.guide.move2", "class.guide.move3"],
    });
    stages.push({
      key: "class_import_other",
      n: 5,
      titleKey: "class.guide.importFromOtherTitle",
      linesKeys: ["class.guide.importFromOther1", "class.guide.importFromOther2", "class.guide.importFromOther3"],
    });
  }
  stages.push({
    key: "class_register",
    n: viewerRole === "owner" || viewerRole === "department_head" ? 6 : 4,
    titleKey: "class.guide.registerTitle",
    linesKeys: ["class.guide.register1", "class.guide.register2", "class.guide.register3"],
  });
  return stages;
}

export function ClassWorkspaceGuide({
  viewerRole,
  activeStageKey,
}: {
  viewerRole: RomRole;
  activeStageKey?: string;
}) {
  const { t } = useUiLanguage();
  const stages = useMemo(() => classWorkspaceGuideStages(viewerRole), [viewerRole]);
  const [internalKey, setInternalKey] = useState("");
  useEffect(() => {
    setInternalKey(activeStageKey ?? "");
  }, [activeStageKey]);
  const activeStage = stages.find((s) => s.key === internalKey);

  return (
    <div className="mt-4 border-t border-emerald-100 pt-4 text-left">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-800/90">{t("dash.guide.title")}</h3>
      {activeStage ? (
        <div className="mt-2 rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
          <ol className="ml-5 list-decimal space-y-1.5 text-left text-xs leading-relaxed text-zinc-600">
            {activeStage.linesKeys.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
