"use client";

import { ArrowLeft, MessageCircle, Plus, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { ICON_INLINE } from "@/components/ui/iconSizes";
import {
  formatSupportCaseNumber,
  SUPPORT_CATEGORIES,
  type SupportCaseRow,
  type SupportCaseWithMessages,
  type SupportCategory,
  type SupportMessageRow,
} from "@/lib/data/supportMessaging";

type Props = {
  tenantId?: string | null;
};

type View = "list" | "new" | "detail";

type CaseListItem = SupportCaseRow & { unread_for_user: boolean };

export function SupportMessenger({ tenantId = null }: Props) {
  const { t } = useUiLanguage();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("list");
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [activeCase, setActiveCase] = useState<SupportCaseWithMessages | null>(null);
  const [unread, setUnread] = useState(0);
  const [draft, setDraft] = useState("");
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<SupportCategory>("technical");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const prevUnread = useRef(0);
  const listEndRef = useRef<HTMLDivElement | null>(null);

  const hiddenOnRoute = pathname?.startsWith("/saas-owner") ?? false;

  const refreshList = useCallback(async () => {
    const res = await fetch("/api/support", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || t("support.errLoad"));
    const count = Number(data.unread ?? 0);
    if (count > prevUnread.current && !open) {
      setToast(t("support.newReplyToast"));
    }
    prevUnread.current = count;
    setUnread(count);
    setCases((data.cases ?? []) as CaseListItem[]);
    return data;
  }, [open, t]);

  const loadCase = useCallback(
    async (caseId: string) => {
      const res = await fetch(`/api/support/cases/${encodeURIComponent(caseId)}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("support.errLoad"));
      setActiveCase(data.case as SupportCaseWithMessages);
      setUnread(Number(data.unread ?? 0));
      prevUnread.current = Number(data.unread ?? 0);
      setView("detail");
    },
    [t],
  );

  useEffect(() => {
    if (hiddenOnRoute) return;
    void refreshList().catch(() => {});
    const id = window.setInterval(() => void refreshList().catch(() => {}), 30_000);
    const onFocus = () => void refreshList().catch(() => {});
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [hiddenOnRoute, refreshList]);

  useEffect(() => {
    if (!open || view !== "detail") return;
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [open, view, activeCase?.messages.length]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(id);
  }, [toast]);

  function openPanel() {
    setOpen(true);
    setView("list");
    setLoadErr(null);
    setToast(null);
    void refreshList().catch((e: unknown) => {
      setLoadErr(e instanceof Error ? e.message : t("support.errLoad"));
    });
  }

  async function submitNewCase() {
    if (busy) return;
    setBusy(true);
    setLoadErr(null);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "create_case",
          subject: subject.trim(),
          category,
          description: description.trim(),
          tenant_id: tenantId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("support.errSend"));
      setSubject("");
      setDescription("");
      setCategory("technical");
      setCases((data.cases ?? []) as CaseListItem[]);
      setActiveCase(data.case as SupportCaseWithMessages);
      setView("detail");
    } catch (e: unknown) {
      setLoadErr(e instanceof Error ? e.message : t("support.errSend"));
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage() {
    const text = draft.trim();
    if (!text || busy || !activeCase) return;
    setBusy(true);
    setLoadErr(null);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "message",
          case_id: activeCase.id,
          message: text,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("support.errSend"));
      setDraft("");
      setActiveCase(data.case as SupportCaseWithMessages);
      setCases((data.cases ?? []) as CaseListItem[]);
      setUnread(Number(data.unread ?? 0));
    } catch (e: unknown) {
      setLoadErr(e instanceof Error ? e.message : t("support.errSend"));
    } finally {
      setBusy(false);
    }
  }

  if (hiddenOnRoute) return null;

  const resolved = activeCase?.status === "resolved";
  const caseLabel = activeCase ? formatSupportCaseNumber(activeCase.case_number, activeCase.created_at) : "";

  return (
    <>
      {toast && !open ? (
        <button
          type="button"
          onClick={() => openPanel()}
          className="fixed bottom-5 right-5 z-40 max-w-sm rounded-xl border border-emerald-300 bg-white px-4 py-3 text-left text-sm text-zinc-900 shadow-lg hover:bg-emerald-50/80"
        >
          <span className="font-semibold text-emerald-900">{t("support.newReplyTitle")}</span>
          <span className="mt-1 block text-zinc-600">{toast}</span>
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        className="relative inline-flex shrink-0 items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-emerald-50/80"
        aria-label={t("support.buttonLabel")}
      >
        <MessageCircle className={ICON_INLINE} aria-hidden />
        <span className="hidden sm:inline">{t("support.buttonLabel")}</span>
        {unread > 0 ? (
          <span
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white"
            aria-label={t("support.unreadBadge")}
          >
            {unread > 9 ? "9+" : unread}
          </span>
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
          <div className="relative flex max-h-[min(36rem,90vh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-emerald-100 px-4 py-3">
              <div className="flex items-center gap-2">
                {view !== "list" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setView("list");
                      setActiveCase(null);
                      setLoadErr(null);
                    }}
                    className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100"
                    aria-label={t("support.backToList")}
                  >
                    <ArrowLeft className={ICON_INLINE} aria-hidden />
                  </button>
                ) : null}
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900">
                    {view === "new" ? t("support.newCaseTitle") : view === "detail" ? caseLabel : t("support.panelTitle")}
                  </h2>
                  <p className="text-xs text-zinc-500">
                    {view === "new" ? t("support.newCaseLead") : view === "detail" && resolved ? t("support.caseResolved") : t("support.panelLead")}
                  </p>
                </div>
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
              {view === "list" ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setView("new");
                      setLoadErr(null);
                    }}
                    className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
                  >
                    <Plus className={ICON_INLINE} aria-hidden />
                    {t("support.newCaseButton")}
                  </button>
                  {cases.length === 0 ? (
                    <p className="text-sm text-zinc-600">{t("support.noCasesYet")}</p>
                  ) : (
                    <ul className="space-y-2">
                      {cases.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => void loadCase(c.id).catch((e) => setLoadErr(e instanceof Error ? e.message : t("support.errLoad")))}
                            className="w-full rounded-xl border border-emerald-100 bg-emerald-50/40 px-3 py-2.5 text-left hover:bg-emerald-50"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-semibold text-emerald-900">
                                {formatSupportCaseNumber(c.case_number, c.created_at)}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                  c.status === "resolved"
                                    ? "bg-zinc-200 text-zinc-700"
                                    : "bg-amber-100 text-amber-900"
                                }`}
                              >
                                {c.status === "resolved" ? t("support.statusResolved") : t("support.statusOpen")}
                              </span>
                            </div>
                            <p className="mt-1 text-sm font-medium text-zinc-900">{c.subject}</p>
                            {c.unread_for_user ? (
                              <p className="mt-1 text-xs font-medium text-red-700">{t("support.unreadReply")}</p>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : null}

              {view === "new" ? (
                <div className="space-y-3">
                  <label className="block text-xs font-medium text-zinc-700">
                    {t("support.fieldSubject")}
                    <input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm"
                      maxLength={200}
                    />
                  </label>
                  <label className="block text-xs font-medium text-zinc-700">
                    {t("support.fieldCategory")}
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as SupportCategory)}
                      className="mt-1 w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm"
                    >
                      {SUPPORT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {t(`support.category.${cat}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-zinc-700">
                    {t("support.fieldDescription")}
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={5}
                      className="mt-1 w-full resize-none rounded-lg border border-emerald-200 px-3 py-2 text-sm"
                      placeholder={t("support.fieldDescriptionPlaceholder")}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy || !subject.trim() || !description.trim()}
                    onClick={() => void submitNewCase()}
                    className="w-full rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
                  >
                    {busy ? t("support.submittingCase") : t("support.submitCase")}
                  </button>
                </div>
              ) : null}

              {view === "detail" && activeCase ? (
                <>
                  <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-sm">
                    <p className="font-medium text-zinc-900">{activeCase.subject}</p>
                    <p className="mt-1 text-xs text-zinc-600">
                      {t(`support.category.${activeCase.category}`)} · {new Date(activeCase.created_at).toLocaleString()}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-zinc-800">{activeCase.description}</p>
                  </div>
                  <ul className="space-y-3">
                    {(activeCase.messages ?? []).map((m: SupportMessageRow) => {
                      const mine = m.sender_role === "user";
                      const system = m.sender_role === "system";
                      return (
                        <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                              system
                                ? "border border-sky-200 bg-sky-50 text-sky-950"
                                : mine
                                  ? "bg-emerald-800 text-white"
                                  : "border border-emerald-200 bg-emerald-50/80 text-zinc-900"
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{m.body}</p>
                            <p
                              className={`mt-1 text-[10px] ${
                                mine ? "text-emerald-100" : system ? "text-sky-700" : "text-zinc-500"
                              }`}
                            >
                              {new Date(m.created_at).toLocaleString()}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                    <li ref={listEndRef} />
                  </ul>
                </>
              ) : null}
            </div>

            {loadErr ? <p className="px-4 pb-2 text-sm text-red-700">{loadErr}</p> : null}

            {view === "detail" && activeCase && !resolved ? (
              <div className="border-t border-emerald-100 p-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  placeholder={t("support.messagePlaceholder")}
                  className="w-full resize-none rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  disabled={busy || !draft.trim()}
                  onClick={() => void sendMessage()}
                  className="mt-2 w-full rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
                >
                  {busy ? t("support.sending") : t("support.send")}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
