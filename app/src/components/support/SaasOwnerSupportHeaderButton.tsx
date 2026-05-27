"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { ContactSupportHeaderButton } from "@/components/support/ContactSupportHeaderButton";
import { SaasOwnerSupportPanel } from "@/components/support/SaasOwnerSupportPanel";
import { ICON_INLINE } from "@/components/ui/iconSizes";

export function SaasOwnerSupportHeaderButton() {
  const { t } = useUiLanguage();
  const [open, setOpen] = useState(false);
  const [unreadCases, setUnreadCases] = useState(0);

  const refreshUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/saas-owner/support", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setUnreadCases(Number(data.unreadCases ?? 0));
    } catch {
      /* ignore polling errors */
    }
  }, []);

  useEffect(() => {
    void refreshUnread();
    const id = window.setInterval(() => void refreshUnread(), 30_000);
    const onFocus = () => void refreshUnread();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshUnread]);

  useEffect(() => {
    if (!open) return;
    void refreshUnread();
  }, [open, refreshUnread]);

  return (
    <>
      <ContactSupportHeaderButton
        unread={unreadCases}
        active={open}
        onClick={() => setOpen((v) => !v)}
      />

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-zinc-950/40"
            aria-label={t("archive.close")}
            onClick={() => setOpen(false)}
          />
          <div className="relative flex max-h-[min(40rem,92vh)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">Customer service</h2>
                <p className="text-xs text-zinc-500">Support cases from signed-in users</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100"
                aria-label={t("archive.close")}
              >
                <X className={ICON_INLINE} aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <SaasOwnerSupportPanel embedded />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
