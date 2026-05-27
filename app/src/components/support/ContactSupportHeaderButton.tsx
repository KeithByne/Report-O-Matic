"use client";

import { MessageCircle } from "lucide-react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { HEADER_CONTROL_BLOCK_INTERACTIVE } from "@/components/layout/headerControlStyles";
import { ICON_INLINE } from "@/components/ui/iconSizes";

type Props = {
  onClick: () => void;
  unread?: number;
  active?: boolean;
};

export function ContactSupportHeaderButton({ onClick, unread = 0, active = false }: Props) {
  const { t } = useUiLanguage();

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("support.buttonLabel")}
      aria-expanded={active}
      className={`${HEADER_CONTROL_BLOCK_INTERACTIVE} relative text-zinc-700`}
    >
      <MessageCircle className={ICON_INLINE} aria-hidden />
      <span className="flex flex-col items-center leading-none">
        <span className="text-[11px] font-semibold">{t("support.buttonContact")}</span>
        <span className="text-[11px] font-semibold">{t("support.buttonSupport")}</span>
      </span>
      {unread > 0 ? (
        <span
          className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white"
          aria-label={t("support.unreadBadge")}
        >
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </button>
  );
}
