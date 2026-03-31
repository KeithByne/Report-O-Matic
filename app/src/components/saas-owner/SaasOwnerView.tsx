"use client";

import { useEffect, useMemo, useState } from "react";

type TenantHit = {
  tenant_id: string;
  tenant_name: string;
  owner_emails: string[];
};

type FinanceSummary = {
  range: string;
  from: string | null;
  to: string;
  payments_in: { count: number; amount_cents: number };
  agent_payouts_out: { count: number; amount_cents: number };
  agent?: string;
};

type OpenAiBalanceResp =
  | { ok: true; source: string; data: any }
  | { ok: false; status?: number; error: string; detail?: string };

type OpenAiSpendSummary = {
  range: string;
  from: string | null;
  to: string;
  totals: {
    requests: number;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    est_cost_usd: number;
    by_kind: {
      draft: { requests: number; total_tokens: number; est_cost_usd: number };
      translate: { requests: number; total_tokens: number; est_cost_usd: number };
    };
    by_model: Record<string, { requests: number; total_tokens: number; est_cost_usd: number }>;
  };
};

function fmtUsdPrecise(v: number): string {
  const n = Number(v ?? 0);
  const abs = Math.abs(n);
  const frac = abs < 0.01 ? 4 : 2; // show tenths-of-cents for small values
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: frac,
      maximumFractionDigits: 6,
    }).format(n);
  } catch {
    return `USD ${n.toFixed(Math.max(2, frac))}`;
  }
}

function fmtMoney(cents: number, currency = "USD"): string {
  const v = (cents ?? 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(v);
  } catch {
    return `${currency} ${v.toFixed(2)}`;
  }
}

export function SaasOwnerView({ viewerEmail }: { viewerEmail: string }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hits, setHits] = useState<TenantHit[]>([]);

  const [range, setRange] = useState<"day" | "week" | "month" | "year" | "ytd" | "all">("month");
  const [agentFilter, setAgentFilter] = useState("");
  const [finBusy, setFinBusy] = useState(false);
  const [finErr, setFinErr] = useState<string | null>(null);
  const [fin, setFin] = useState<FinanceSummary | null>(null);

  const [balBusy, setBalBusy] = useState(false);
  const [balErr, setBalErr] = useState<string | null>(null);
  const [bal, setBal] = useState<OpenAiBalanceResp | null>(null);
  const [balTick, setBalTick] = useState(0);

  const [spendRange, setSpendRange] = useState<"day" | "week" | "month" | "year" | "ytd" | "all">("month");
  const [spendBusy, setSpendBusy] = useState(false);
  const [spendErr, setSpendErr] = useState<string | null>(null);
  const [spend, setSpend] = useState<OpenAiSpendSummary | null>(null);
  const [spendTick, setSpendTick] = useState(0);

  const query = useMemo(() => q.trim(), [q]);
  const agent = useMemo(() => agentFilter.trim(), [agentFilter]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setBusy(true);
      setErr(null);
      try {
        const u = new URL(window.location.origin + "/api/saas-owner/tenants");
        if (query) u.searchParams.set("q", query);
        const res = await fetch(u.toString(), { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed");
        if (!cancelled) setHits((data.tenants ?? []) as TenantHit[]);
      } catch (e: unknown) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setFinBusy(true);
      setFinErr(null);
      try {
        const u = new URL(window.location.origin + "/api/saas-owner/finance/summary");
        u.searchParams.set("range", range);
        if (agent) u.searchParams.set("agent", agent.toLowerCase());
        const res = await fetch(u.toString(), { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed");
        if (!cancelled) setFin(data as FinanceSummary);
      } catch (e: unknown) {
        if (!cancelled) setFinErr(e instanceof Error ? e.message : "Failed");
      } finally {
        if (!cancelled) setFinBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range, agent]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setBalBusy(true);
      setBalErr(null);
      try {
        const res = await fetch("/api/saas-owner/openai/balance", { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as OpenAiBalanceResp;
        if (!cancelled) setBal(data);
        if (!res.ok) {
          const status = "status" in data && typeof data.status === "number" ? data.status : res.status;
          const detail = "detail" in data && typeof data.detail === "string" ? data.detail : "";
          const msg = `${("error" in data && typeof data.error === "string" ? data.error : "OpenAI balance failed.")} (${status})${
            detail ? ` — ${detail}` : ""
          }`;
          throw new Error(msg);
        }
      } catch (e: unknown) {
        if (!cancelled) setBalErr(e instanceof Error ? e.message : "Failed");
      } finally {
        if (!cancelled) setBalBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [balTick]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setSpendBusy(true);
      setSpendErr(null);
      try {
        const u = new URL(window.location.origin + "/api/saas-owner/openai/spend/summary");
        u.searchParams.set("range", spendRange);
        const res = await fetch(u.toString(), { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as OpenAiSpendSummary & { error?: string };
        if (!res.ok) throw new Error(data.error || "Failed");
        if (!cancelled) setSpend(data as OpenAiSpendSummary);
      } catch (e: unknown) {
        if (!cancelled) setSpendErr(e instanceof Error ? e.message : "Failed");
      } finally {
        if (!cancelled) setSpendBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spendRange, spendTick]);

  return (
    <div className="min-h-screen bg-emerald-100/80 text-zinc-950">
      <header className="border-b border-emerald-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Platform</div>
            <div className="text-lg font-semibold tracking-tight">SaaS Owner Dashboard</div>
          </div>
          <div className="text-xs text-zinc-500">
            Signed in as <span className="font-mono text-zinc-800">{viewerEmail}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-5 py-6">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-zinc-900">OpenAI</div>
              <div className="mt-1 text-xs text-zinc-500">
                Balance cannot be fetched via secret API keys; this shows real-time spend based on logged usage.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setBalTick((n) => n + 1);
                  setSpendTick((n) => n + 1);
                }}
                disabled={balBusy || spendBusy}
                className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-emerald-100 disabled:opacity-50"
              >
                {balBusy || spendBusy ? "Refreshing…" : "Refresh OpenAI data"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setBalErr(null);
                  setSpendErr(null);
                  setBal(null);
                }}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Clear errors
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="text-sm">
              <span className="text-zinc-600">Range</span>
              <select
                value={spendRange}
                onChange={(e) => setSpendRange(e.target.value as typeof spendRange)}
                className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm"
              >
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="year">Year</option>
                <option value="ytd">To date (YTD)</option>
                <option value="all">All time</option>
              </select>
            </label>
            <a
              href="https://platform.openai.com/settings/organization/billing/overview"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              OpenAI billing (balance)
            </a>
          </div>

          {spendErr ? <div className="mt-3 text-sm text-red-700">{spendErr}</div> : null}
          {spend ? (
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Estimated spend</div>
                <div className="mt-1 text-lg font-semibold text-zinc-900">
                  {fmtUsdPrecise(spend.totals.est_cost_usd)}
                </div>
                <div className="mt-1 text-xs text-zinc-500">{spend.totals.requests} request(s)</div>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Tokens</div>
                <div className="mt-1 text-sm font-semibold text-zinc-900">{spend.totals.total_tokens.toLocaleString()}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  prompt {spend.totals.prompt_tokens.toLocaleString()} • completion {spend.totals.completion_tokens.toLocaleString()}
                </div>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">By kind</div>
                <div className="mt-1 text-xs text-zinc-700">
                  Draft: {spend.totals.by_kind.draft.requests} req •{" "}
                  {fmtUsdPrecise(spend.totals.by_kind.draft.est_cost_usd)}
                </div>
                <div className="mt-1 text-xs text-zinc-700">
                  Translate: {spend.totals.by_kind.translate.requests} req •{" "}
                  {fmtUsdPrecise(spend.totals.by_kind.translate.est_cost_usd)}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3 text-sm text-zinc-600">{spendBusy ? "Loading…" : "—"}</div>
          )}

          {/* Keep the old balance response available for debugging (it will be 501). */}
          {balErr ? <div className="mt-3 text-xs text-zinc-500">{balErr}</div> : null}
          {bal && bal.ok === false ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-zinc-600">Why balance isn’t available</summary>
              <pre className="mt-2 max-h-40 overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-800">
                {JSON.stringify(bal, null, 2)}
              </pre>
            </details>
          ) : null}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full">
              <div className="text-sm font-semibold text-zinc-900">Finance</div>
              <div className="mt-1 text-xs text-zinc-500">
                Payments in (Stripe) and agent payouts out, with day/week/month/year/YTD filters.
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                <label className="text-sm">
                  <span className="text-zinc-600">Range</span>
                  <select
                    value={range}
                    onChange={(e) => setRange(e.target.value as typeof range)}
                    className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="day">Day</option>
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                    <option value="year">Year</option>
                    <option value="ytd">To date (YTD)</option>
                    <option value="all">All time</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className="text-zinc-600">Agent (optional)</span>
                  <input
                    value={agentFilter}
                    onChange={(e) => setAgentFilter(e.target.value)}
                    placeholder="agent email/account…"
                    className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <div className="text-sm text-zinc-600">{finBusy ? "Loading…" : ""}</div>
              </div>
            </div>
          </div>
          {finErr ? <div className="mt-3 text-sm text-red-700">{finErr}</div> : null}
          {fin ? (
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Paid to SaaS</div>
                <div className="mt-1 text-lg font-semibold text-zinc-900">{fmtMoney(fin.payments_in.amount_cents)}</div>
                <div className="mt-1 text-xs text-zinc-500">{fin.payments_in.count} payment(s)</div>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Paid to agents</div>
                <div className="mt-1 text-lg font-semibold text-zinc-900">{fmtMoney(fin.agent_payouts_out.amount_cents)}</div>
                <div className="mt-1 text-xs text-zinc-500">{fin.agent_payouts_out.count} payout(s)</div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full">
              <label className="text-sm font-medium text-zinc-800">Search schools / owners</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Type a keyword (school name or owner email)…"
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-400"
              />
              <div className="mt-2 text-xs text-zinc-500">
                Results update as you type. (Searches tenant name + owner emails.)
              </div>
            </div>
            <div className="text-sm text-zinc-600">{busy ? "Loading…" : `${hits.length} result(s)`}</div>
          </div>
          {err ? <div className="mt-3 text-sm text-red-700">{err}</div> : null}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-zinc-900">Schools</div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                  <th className="py-2 pr-3 font-medium">Tenant</th>
                  <th className="py-2 pr-3 font-medium">Tenant ID</th>
                  <th className="py-2 pr-3 font-medium">Owners</th>
                  <th className="py-2 pr-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {hits.map((t) => (
                  <tr key={t.tenant_id} className="border-b border-zinc-100">
                    <td className="py-2 pr-3 font-medium text-zinc-900">{t.tenant_name}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-zinc-700">{t.tenant_id}</td>
                    <td className="py-2 pr-3 text-xs text-zinc-700">
                      {t.owner_emails.length ? t.owner_emails.join(", ") : "—"}
                    </td>
                    <td className="py-2 pr-3">
                      <a
                        href={`/api/tenants/${encodeURIComponent(t.tenant_id)}/export`}
                        className="text-xs font-semibold text-emerald-700 hover:underline"
                      >
                        Export Excel
                      </a>
                    </td>
                  </tr>
                ))}
                {hits.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-sm text-zinc-500">
                      No results.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

