"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import {
  formatSupportCaseNumber,
  isSupportCategory,
  type SupportCaseRow,
  type SupportCaseWithMessages,
  type SupportMessageRow,
} from "@/lib/data/supportMessaging";

type CaseListItem = SupportCaseRow & { unread_for_owner: boolean };

type Props = {
  /** Render without outer page section chrome (header modal). */
  embedded?: boolean;
};

export function SaasOwnerSupportPanel({ embedded = false }: Props) {
  const { t } = useUiLanguage();
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [unreadCases, setUnreadCases] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [supportCase, setSupportCase] = useState<SupportCaseWithMessages | null>(null);
  const [draft, setDraft] = useState("");
  const [resolveNote, setResolveNote] = useState("");
  const [showResolve, setShowResolve] = useState(false);
  const [listBusy, setListBusy] = useState(false);
  const [caseBusy, setCaseBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [resolveBusy, setResolveBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const listEndRef = useRef<HTMLLIElement | null>(null);

  const refreshList = useCallback(async () => {
    setListBusy(true);
    try {
      const res = await fetch("/api/saas-owner/support", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not load cases.");
      setCases((data.cases ?? []) as CaseListItem[]);
      setUnreadCases(Number(data.unreadCases ?? 0));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not load cases.");
    } finally {
      setListBusy(false);
    }
  }, []);

  const loadCase = useCallback(
    async (caseId: string, opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setCaseBusy(true);
        setShowResolve(false);
      }
      setErr(null);
      try {
        const res = await fetch(`/api/saas-owner/support/${encodeURIComponent(caseId)}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not load case.");
        const loaded = data.case as SupportCaseWithMessages;
        setSupportCase((prev) => ({
          ...loaded,
          messages:
            loaded.messages?.length > 0 ? loaded.messages : (prev?.id === caseId ? (prev.messages ?? []) : []),
        }));
        setSelectedId(caseId);
        if (!opts?.silent) void refreshList();
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Could not load case.");
      } finally {
        if (!opts?.silent) setCaseBusy(false);
      }
    },
    [refreshList],
  );

  useEffect(() => {
    void refreshList();
    const id = window.setInterval(() => void refreshList(), 30_000);
    return () => window.clearInterval(id);
  }, [refreshList]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [supportCase?.messages.length]);

  async function sendReply() {
    if (!selectedId || !draft.trim() || sendBusy) return;
    setSendBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/saas-owner/support/${encodeURIComponent(selectedId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: draft.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not send reply.");
      setDraft("");
      setSupportCase(data.case as SupportCaseWithMessages);
      void refreshList();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not send reply.");
    } finally {
      setSendBusy(false);
    }
  }

  async function resolveCase() {
    if (!selectedId || resolveBusy || supportCase?.status === "resolved") return;
    setResolveBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/saas-owner/support/${encodeURIComponent(selectedId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "resolve",
          note: resolveNote.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not resolve case.");
      const resolvedCase = data.case as SupportCaseWithMessages | undefined;
      if (resolvedCase) {
        setSupportCase((prev) => ({
          ...resolvedCase,
          messages:
            resolvedCase.messages?.length > 0
              ? resolvedCase.messages
              : (prev?.id === selectedId ? (prev.messages ?? []) : []),
        }));
      }
      setResolveNote("");
      setShowResolve(false);
      await refreshList();
      if (selectedId) await loadCase(selectedId, { silent: true });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not resolve case.");
    } finally {
      setResolveBusy(false);
    }
  }

  const resolved = supportCase?.status === "resolved";
  const caseLabel = supportCase
    ? formatSupportCaseNumber(supportCase.case_number, supportCase.created_at)
    : "";

  const body = (
    <>
      {!embedded ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-zinc-900">Customer service</div>
            <div className="mt-1 text-xs text-zinc-500">
              Support cases from signed-in users.{" "}
              {unreadCases > 0 ? `${unreadCases} case(s) with new messages.` : "No new messages."}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void refreshList()}
            disabled={listBusy}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            {listBusy ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      ) : (
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-xs text-zinc-500">
            {unreadCases > 0 ? `${unreadCases} case(s) with new messages.` : "No new messages."}
          </p>
          <button
            type="button"
            onClick={() => void refreshList()}
            disabled={listBusy}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            {listBusy ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      )}

      {err ? <div className={`text-sm text-red-700 ${embedded ? "mb-3" : "mt-3"}`}>{err}</div> : null}

      <div className={`grid gap-4 lg:grid-cols-[minmax(12rem,34%)_1fr] ${embedded ? "" : "mt-4"}`}>
        <div className="max-h-80 overflow-y-auto rounded-xl border border-zinc-200">
          {cases.length === 0 ? (
            <p className="p-3 text-sm text-zinc-500">No support cases yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {cases.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => void loadCase(row.id)}
                    className={`w-full px-3 py-2.5 text-left text-sm hover:bg-zinc-50 ${
                      selectedId === row.id ? "bg-emerald-50/80" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-emerald-900">
                        {formatSupportCaseNumber(row.case_number, row.created_at)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        {row.unread_for_owner ? (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-red-600" aria-hidden />
                        ) : null}
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            row.status === "resolved"
                              ? "bg-zinc-200 text-zinc-700"
                              : "bg-amber-100 text-amber-900"
                          }`}
                        >
                          {row.status === "resolved" ? "Resolved" : "Open"}
                        </span>
                      </span>
                    </div>
                    <p className="mt-1 truncate font-medium text-zinc-900">{row.subject}</p>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      {row.display_name?.trim() || row.user_email}
                    </p>
                    {row.tenant_name_snapshot ? (
                      <p className="mt-0.5 truncate text-xs text-zinc-400">{row.tenant_name_snapshot}</p>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex h-[min(28rem,55vh)] min-h-[16rem] flex-col rounded-xl border border-zinc-200">
          {!selectedId ? (
            <p className="flex flex-1 items-center justify-center p-4 text-sm text-zinc-500">
              Select a case to view the issue and reply.
            </p>
          ) : (
            <>
              <div className="border-b border-zinc-100 px-3 py-2">
                {caseBusy ? (
                  <span className="text-xs text-zinc-500">Loading…</span>
                ) : supportCase ? (
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="text-xs text-zinc-600">
                      <span className="font-mono font-semibold text-emerald-900">{caseLabel}</span>
                      <span className="mx-1">·</span>
                      <span className="font-semibold text-zinc-800">
                        {supportCase.display_name || supportCase.user_email}
                      </span>
                      {supportCase.tenant_name_snapshot ? ` · ${supportCase.tenant_name_snapshot}` : null}
                    </div>
                    {!resolved ? (
                      <button
                        type="button"
                        onClick={() => setShowResolve((v) => !v)}
                        className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
                      >
                        {showResolve ? "Cancel" : "Mark as resolved"}
                      </button>
                    ) : (
                      <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-700">
                        Resolved
                      </span>
                    )}
                  </div>
                ) : null}
              </div>

              {supportCase ? (
                <div className="border-b border-zinc-100 bg-zinc-50/80 px-3 py-2 text-sm">
                  <p className="font-medium text-zinc-900">{supportCase.subject}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {isSupportCategory(supportCase.category)
                      ? t(`support.category.${supportCase.category}`)
                      : supportCase.category}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-zinc-800">{supportCase.description}</p>
                </div>
              ) : null}

              {showResolve && !resolved ? (
                <div className="border-b border-emerald-100 bg-emerald-50/50 px-3 py-2">
                  <p className="text-xs text-zinc-600">
                    This sends a message to the user that their issue has been resolved.
                  </p>
                  <textarea
                    value={resolveNote}
                    onChange={(e) => setResolveNote(e.target.value)}
                    rows={2}
                    placeholder="Optional note for the user…"
                    className="mt-2 w-full resize-none rounded-lg border border-emerald-200 px-2 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    disabled={resolveBusy}
                    onClick={() => void resolveCase()}
                    className="mt-2 rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
                  >
                    {resolveBusy ? "Resolving…" : "Confirm resolved"}
                  </button>
                </div>
              ) : null}

              <div className="min-h-[10rem] flex-1 overflow-y-auto px-3 py-2">
                <ul className="space-y-2">
                  {(supportCase?.messages ?? []).length === 0 ? (
                    <li className="py-4 text-center text-xs text-zinc-500">No messages in this case yet.</li>
                  ) : null}
                  {(supportCase?.messages ?? []).map((m: SupportMessageRow) => {
                    const owner = m.sender_role === "owner";
                    const system = m.sender_role === "system";
                    return (
                      <li key={m.id} className={`flex ${owner ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${
                            system
                              ? "border border-sky-200 bg-sky-50 text-sky-950"
                              : owner
                                ? "bg-zinc-900 text-white"
                                : "bg-emerald-50 text-zinc-900"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{m.body}</p>
                          <p
                            className={`mt-1 text-[10px] ${
                              owner ? "text-zinc-300" : system ? "text-sky-700" : "text-zinc-500"
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
              </div>

              {!resolved ? (
                <div className="border-t border-zinc-100 p-3">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={3}
                    placeholder="Type your reply…"
                    className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    disabled={sendBusy || !draft.trim()}
                    onClick={() => void sendReply()}
                    className="mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {sendBusy ? "Sending…" : "Send reply"}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );

  if (embedded) return body;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      {body}
    </section>
  );
}
