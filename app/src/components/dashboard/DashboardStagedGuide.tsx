"use client";

import { ChevronDown } from "lucide-react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { ICON_INLINE } from "@/components/ui/iconSizes";

export type DashboardStagedGuideMode = "owner_hub" | "owner_workspace" | "department_head" | "teacher";

function Stage({
  n,
  titleKey,
  linesKeys,
}: {
  n: number;
  titleKey: string;
  linesKeys: string[];
}) {
  const { t } = useUiLanguage();
  return (
    <details className="group border-b border-emerald-100 py-0.5 last:border-b-0">
      <summary className="flex cursor-pointer list-none items-start gap-2 py-2 text-left [&::-webkit-details-marker]:hidden">
        <ChevronDown
          className={`${ICON_INLINE} mt-0.5 shrink-0 text-emerald-700 transition-transform group-open:rotate-180`}
          aria-hidden
        />
        <span className="text-sm font-semibold text-zinc-900">
          {n}. {t(titleKey)}
        </span>
      </summary>
      <ol className="ml-7 list-decimal space-y-1.5 pb-2 pl-1 text-left text-xs leading-relaxed text-zinc-600">
        {linesKeys.map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ol>
    </details>
  );
}

export function DashboardStagedGuide({ mode }: { mode: DashboardStagedGuideMode }) {
  const { t } = useUiLanguage();
  return (
    <div className="mt-4 border-t border-emerald-100 pt-4 text-left">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-800/90">{t("dash.guide.title")}</h3>
      <div className="mt-2 rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-1">
        {mode === "owner_hub" ? (
          <>
            <Stage
              n={1}
              titleKey="dash.guide.hubAddSchoolTitle"
              linesKeys={["dash.guide.hubAddSchool1", "dash.guide.hubAddSchool2"]}
            />
            <Stage
              n={2}
              titleKey="dash.guide.hubPickSchoolTitle"
              linesKeys={["dash.guide.hubPickSchool1", "dash.guide.hubPickSchool2"]}
            />
          </>
        ) : null}
        {mode === "owner_workspace" ? (
          <>
            <Stage
              n={1}
              titleKey="dash.guide.stepLetterheadTitle"
              linesKeys={["dash.guide.ownerLetterhead1", "dash.guide.ownerLetterhead2", "dash.guide.ownerLetterhead3"]}
            />
            <Stage
              n={2}
              titleKey="dash.guide.stepInviteTitle"
              linesKeys={["dash.guide.invite1", "dash.guide.invite2", "dash.guide.invite3"]}
            />
            <Stage
              n={3}
              titleKey="dash.guide.stepClassesTitle"
              linesKeys={["dash.guide.classDh1", "dash.guide.classDh2", "dash.guide.classDh3"]}
            />
            <Stage
              n={4}
              titleKey="dash.guide.stepReportsTitle"
              linesKeys={["dash.guide.report1", "dash.guide.report2", "dash.guide.report3"]}
            />
          </>
        ) : null}
        {mode === "department_head" ? (
          <>
            <Stage
              n={1}
              titleKey="dash.guide.stepInviteTitle"
              linesKeys={["dash.guide.invite1", "dash.guide.invite2", "dash.guide.invite3"]}
            />
            <Stage
              n={2}
              titleKey="dash.guide.stepClassesTitle"
              linesKeys={["dash.guide.classDh1", "dash.guide.classDh2", "dash.guide.classDh3"]}
            />
            <Stage
              n={3}
              titleKey="dash.guide.stepReportsTitle"
              linesKeys={["dash.guide.report1", "dash.guide.report2", "dash.guide.report3"]}
            />
          </>
        ) : null}
        {mode === "teacher" ? (
          <>
            <Stage
              n={1}
              titleKey="dash.guide.stepClassTeacherTitle"
              linesKeys={["dash.guide.classT1", "dash.guide.classT2", "dash.guide.classT3"]}
            />
            <Stage
              n={2}
              titleKey="dash.guide.stepReportsTitle"
              linesKeys={["dash.guide.report1", "dash.guide.report2", "dash.guide.report3"]}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
