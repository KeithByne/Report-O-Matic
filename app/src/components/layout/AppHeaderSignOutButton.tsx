"use client";

import { LogOut } from "lucide-react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { HEADER_CONTROL_BLOCK_INTERACTIVE } from "@/components/layout/headerControlStyles";
import { ICON_INLINE } from "@/components/ui/iconSizes";

export function AppHeaderSignOutButton() {
  const { t } = useUiLanguage();
  const label = t("nav.signOut");
  const parts = label.trim().split(/\s+/);
  const line1 = parts[0] ?? label;
  const line2 = parts.slice(1).join(" ") || null;

  return (
    <form action="/api/auth/sign-out" method="post" className="shrink-0">
      <button
        type="submit"
        className={`${HEADER_CONTROL_BLOCK_INTERACTIVE} relative text-zinc-700`}
        aria-label={label}
      >
        <LogOut className={ICON_INLINE} aria-hidden />
        <span className="flex flex-col items-center leading-none">
          <span className="text-[11px] font-semibold">{line1}</span>
          {line2 ? <span className="text-[11px] font-semibold">{line2}</span> : null}
        </span>
      </button>
    </form>
  );
}
