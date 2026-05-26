"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupportMessageRow, SupportThreadRow, SupportThreadWithMessages } from "@/lib/data/supportMessaging";

type ThreadListItem = SupportThreadRow & { unread_for_owner: boolean };

export function SaasOwnerSupportPanel() {
  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [unreadThreads, setUnreadThreads] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<SupportThreadWithMessages | null>(null);
  const [draft, setDraft] = useState("");
  const [listBusy, setListBusy] = useState(false);
  const [threadBusy, setThreadBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const listEndRef = useRef<HTMLDivElement | null>(null);

  const refreshList = useCallback(async () => {
    setListBusy(true);
    try {
      const res = await fetch("/api/saas-owner/support", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not load inbox.");
      setThreads((data.threads ?? []) as ThreadListItem[]);
      setUnreadThreads(Number(data.unreadThreads ?? 0));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not load inbox.");
    } finally {
      setListBusy(false);
    }
  }, []);

  const loadThread = useCallback(async (threadId: string) => {
    setThreadBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/saas-owner/support/${encodeURIComponent(threadId)}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not load conversation.");
      setThread(data.thread as SupportThreadWithMessages);
      setSelectedId(threadId);
      void refreshList();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not load conversation.");
    } finally {
      setThreadBusy(false);
    }
  }, [refreshList]);

  useEffect(() => {
    void refreshList();
    const id = window.setInterval(() => void refreshList(), 30_000);
    return () => window.clearInterval(id);
  }, [refreshList]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages.length]);

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
      setThread(data.thread as SupportThreadWithMessages);
      void refreshList();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not send reply.");
    } finally {
      setSendBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-900">Customer service</div>
          <div className="mt-1 text-xs text-zinc-500">
            Messages from signed-in users. {unreadThreads > 0 ? `${unreadThreads} conversation(s) with new messages.` : "No new messages."}
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

      {err ? <div className="mt-3 text-sm text-red-700">{err}</div> : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(12rem,34%)_1fr]">
        <div className="max-h-80 overflow-y-auto rounded-xl border border-zinc-200">
          {threads.length === 0 ? (
            <p className="p-3 text-sm text-zinc-500">No conversations yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {threads.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => void loadThread(row.id)}
                    className={`w-full px-3 py-2.5 text-left text-sm hover:bg-zinc-50 ${
                      selectedId === row.id ? "bg-emerald-50/80" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-zinc-900">
                        {row.display_name?.trim() || row.user_email}
                      </span>
                      {row.unread_for_owner ? (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-red-600" aria-hidden />
                      ) : null}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-zinc-500">{row.user_email}</div>
                    {row.tenant_name_snapshot ? (
                      <div className="mt-0.5 truncate text-xs text-zinc-400">{row.tenant_name_snapshot}</div>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex min-h-[16rem] flex-col rounded-xl border border-zinc-200">
          {!selectedId ? (
            <p className="flex flex-1 items-center justify-center p-4 text-sm text-zinc-500">
              Select a conversation to reply.
            </p>
          ) : (
            <>
              <div className="border-b border-zinc-100 px-3 py-2 text-xs text-zinc-600">
                {threadBusy ? "Loading…" : thread ? (
                  <>
                    <span className="font-semibold text-zinc-800">{thread.display_name || thread.user_email}</span>
                    {thread.tenant_name_snapshot ? ` · ${thread.tenant_name_snapshot}` : null}
                  </>
                ) : null}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
                <ul className="space-y-2">
                  {(thread?.messages ?? []).map((m: SupportMessageRow) => {
                    const owner = m.sender_role === "owner";
                    return (
                      <li key={m.id} className={`flex ${owner ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${
                            owner ? "bg-zinc-900 text-white" : "bg-emerald-50 text-zinc-900"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{m.body}</p>
                          <p className={`mt-1 text-[10px] ${owner ? "text-zinc-300" : "text-zinc-500"}`}>
                            {new Date(m.created_at).toLocaleString()}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                  <li ref={listEndRef} />
                </ul>
              </div>
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
            </>
          )}
        </div>
      </div>
    </section>
  );
}
