"use client";

import { MessageCircle, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { ICON_INLINE } from "@/components/ui/iconSizes";
import type { SupportMessageRow, SupportThreadWithMessages } from "@/lib/data/supportMessaging";

type Props = {
  tenantId?: string | null;
};

export function SupportMessenger({ tenantId = null }: Props) {
  const { t } = useUiLanguage();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);
  const [thread, setThread] = useState<SupportThreadWithMessages | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const prevUnread = useRef(false);
  const listEndRef = useRef<HTMLDivElement | null>(null);

  const hiddenOnRoute = pathname?.startsWith("/saas-owner") ?? false;

  const refresh = useCallback(
    async (opts?: { markRead?: boolean; openPanel?: boolean }) => {
      const qp = opts?.markRead ? "?markRead=1" : "";
      const res = await fetch(`/api/support${qp}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("support.errLoad"));
      const hasUnread = Boolean(data.unread);
      if (!opts?.openPanel && hasUnread && !prevUnread.current && !open) {
        setToast(t("support.newReplyToast"));
      }
      prevUnread.current = hasUnread;
      setUnread(hasUnread);
      if (data.thread) setThread(data.thread as SupportThreadWithMessages);
      return data;
    },
    [open, t],
  );

  useEffect(() => {
    if (hiddenOnRoute) return;
    void refresh().catch(() => {});
    const id = window.setInterval(() => {
      void refresh().catch(() => {});
    }, 30_000);
    const onFocus = () => void refresh().catch(() => {});
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [hiddenOnRoute, refresh]);

  useEffect(() => {
    if (!open) return;
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [open, thread?.messages.length]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(id);
  }, [toast]);

  async function openPanel() {
    setOpen(true);
    setLoadErr(null);
    setToast(null);
    try {
      await refresh({ markRead: true, openPanel: true });
    } catch (e: unknown) {
      setLoadErr(e instanceof Error ? e.message : t("support.errLoad"));
    }
  }

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setLoadErr(null);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, tenant_id: tenantId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("support.errSend"));
      setDraft("");
      setThread((data.thread as SupportThreadWithMessages) ?? null);
      setUnread(false);
      prevUnread.current = false;
    } catch (e: unknown) {
      setLoadErr(e instanceof Error ? e.message : t("support.errSend"));
    } finally {
      setBusy(false);
    }
  }

  if (hiddenOnRoute) return null;

  const messages = thread?.messages ?? [];

  return (
    <>
      {toast && !open ? (
        <button
          type="button"
          onClick={() => void openPanel()}
          className="fixed bottom-5 right-5 z-40 max-w-sm rounded-xl border border-emerald-300 bg-white px-4 py-3 text-left text-sm text-zinc-900 shadow-lg hover:bg-emerald-50/80"
        >
          <span className="font-semibold text-emerald-900">{t("support.newReplyTitle")}</span>
          <span className="mt-1 block text-zinc-600">{toast}</span>
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => (open ? setOpen(false) : void openPanel())}
        className="relative inline-flex shrink-0 items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-emerald-50/80"
        aria-label={t("support.buttonLabel")}
        title={t("support.buttonLabel")}
      >
        <MessageCircle className={ICON_INLINE} aria-hidden />
        <span className="hidden sm:inline">{t("support.buttonLabel")}</span>
        {unread ? (
          <span
            className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white"
            aria-label={t("support.unreadBadge")}
          />
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-zinc-950/40"
            aria-label={t("archive.close")}
            onClick={() => setOpen(false)}
          />
          <div className="relative flex max-h-[min(32rem,85vh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-emerald-100 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">{t("support.panelTitle")}</h2>
                <p className="text-xs text-zinc-500">{t("support.panelLead")}</p>
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

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {messages.length === 0 ? (
                <p className="text-sm text-zinc-600">{t("support.emptyThread")}</p>
              ) : (
                <ul className="space-y-3">
                  {messages.map((m: SupportMessageRow) => {
                    const mine = m.sender_role === "user";
                    return (
                      <li
                        key={m.id}
                        className={`flex ${mine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                            mine
                              ? "bg-emerald-800 text-white"
                              : "border border-emerald-200 bg-emerald-50/80 text-zinc-900"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{m.body}</p>
                          <p className={`mt-1 text-[10px] ${mine ? "text-emerald-100" : "text-zinc-500"}`}>
                            {new Date(m.created_at).toLocaleString()}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                  <li ref={listEndRef} />
                </ul>
              )}
            </div>

            {loadErr ? <p className="px-4 pb-2 text-sm text-red-700">{loadErr}</p> : null}

            <div className="border-t border-emerald-100 p-3">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                placeholder={t("support.messagePlaceholder")}
                className="w-full resize-none rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                disabled={busy || !draft.trim()}
                onClick={() => void send()}
                className="mt-2 w-full rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
              >
                {busy ? t("support.sending") : t("support.send")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
