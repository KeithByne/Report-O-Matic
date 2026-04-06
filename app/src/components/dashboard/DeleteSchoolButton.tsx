"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { ICON_INLINE } from "@/components/ui/iconSizes";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { useState } from "react";

type Props = { tenantId: string; schoolName: string };

export function DeleteSchoolButton({ tenantId, schoolName }: Props) {
  const { t } = useUiLanguage();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    const token = t("deleteSchool.confirmToken");
    const typed = window.prompt(t("deleteSchool.prompt", { name: schoolName }));
    if (typed !== token) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      router.push("/dashboard");
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void onDelete()}
      className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-900 hover:bg-red-100 disabled:opacity-50"
    >
      <Trash2 className={`${ICON_INLINE} opacity-90`} aria-hidden />
      {busy ? t("deleteSchool.deleting") : t("deleteSchool.button")}
    </button>
  );
}
