"use client";

import { useEffect, useMemo, useState } from "react";

type TenantHit = {
  tenant_id: string;
  tenant_name: string;
  owner_emails: string[];
};

type CreditPack = {
  id: string;
  name: string;
  price_cents: number;
  currency: string;
  report_credits: number;
  active: boolean;
  sort_order: number;
};

type AgentLink = {
  code: string;
  agent_email: string;
  display_name: string | null;
  active: boolean;
  commission_bps: number;
  payout_wait_days?: number;
  inactive_after_days: number;
  last_active_at: string | null;
  created_at: string;
};

type ReferralEarning = {
  id: string;
  agent_code: string | null;
  agent_email: string;
  tenant_id: string | null;
  amount_cents: number;
  currency: string;
  commission_cents: number;
  eligible_at: string;
  status: string;
  computed_status?: string;
  created_at: string;
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

  const [spendRange, setSpendRange] = useState<"day" | "week" | "month" | "year" | "ytd" | "all">("month");
  const [spendBusy, setSpendBusy] = useState(false);
  const [spendErr, setSpendErr] = useState<string | null>(null);
  const [spend, setSpend] = useState<OpenAiSpendSummary | null>(null);
  const [spendTick, setSpendTick] = useState(0);

  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [packsBusy, setPacksBusy] = useState(false);
  const [packsErr, setPacksErr] = useState<string | null>(null);

  const [agents, setAgents] = useState<AgentLink[]>([]);
  const [agentsBusy, setAgentsBusy] = useState(false);
  const [agentsErr, setAgentsErr] = useState<string | null>(null);
  const [newAgentEmail, setNewAgentEmail] = useState("");
  const [newAgentName, setNewAgentName] = useState("");

  const [earnings, setEarnings] = useState<ReferralEarning[]>([]);
  const [packEdits, setPackEdits] = useState<Record<string, Partial<CreditPack>>>({});
  const [packSaving, setPackSaving] = useState<Record<string, boolean>>({});

  const [agentEdits, setAgentEdits] = useState<Record<string, Partial<AgentLink>>>({});
  const [agentSaving, setAgentSaving] = useState<Record<string, boolean>>({});

  const [earnBusy, setEarnBusy] = useState(false);
  const [earnErr, setEarnErr] = useState<string | null>(null);
  const [earnAgentFilter, setEarnAgentFilter] = useState("");
  const [earnStatus, setEarnStatus] = useState<"" | "pending" | "eligible" | "paid" | "void">("");

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

  async function refreshPacks() {
    setPacksBusy(true);
    setPacksErr(null);
    try {
      const res = await fetch("/api/saas-owner/packs", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      const rows = (data.packs ?? []) as CreditPack[];
      setPacks(rows);
      setPackEdits((prev) => {
        const next = { ...prev };
        for (const p of rows) {
          if (!next[p.id]) next[p.id] = {};
        }
        return next;
      });
    } catch (e: unknown) {
      setPacksErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setPacksBusy(false);
    }
  }

  async function refreshAgents() {
    setAgentsBusy(true);
    setAgentsErr(null);
    try {
      const res = await fetch("/api/saas-owner/agents", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      const rows = (data.agents ?? []) as AgentLink[];
      setAgents(rows);
      setAgentEdits((prev) => {
        const next = { ...prev };
        for (const a of rows) {
          if (!next[a.code]) next[a.code] = {};
        }
        return next;
      });
    } catch (e: unknown) {
      setAgentsErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setAgentsBusy(false);
    }
  }

  async function refreshEarnings() {
    setEarnBusy(true);
    setEarnErr(null);
    try {
      const u = new URL(window.location.origin + "/api/saas-owner/referrals/earnings");
      if (earnAgentFilter.trim()) u.searchParams.set("agent", earnAgentFilter.trim().toLowerCase());
      if (earnStatus) u.searchParams.set("status", earnStatus);
      const res = await fetch(u.toString(), { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      setEarnings((data.earnings ?? []) as ReferralEarning[]);
    } catch (e: unknown) {
      setEarnErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setEarnBusy(false);
    }
  }

  useEffect(() => {
    void refreshPacks();
    void refreshAgents();
    void refreshEarnings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-zinc-900">Credit packs</div>
              <div className="mt-1 text-xs text-zinc-500">Manage pricing and how many reports each pack includes.</div>
            </div>
            <button
              type="button"
              onClick={() => void refreshPacks()}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              {packsBusy ? "Refreshing…" : "Refresh packs"}
            </button>
          </div>
          {packsErr ? <div className="mt-3 text-sm text-red-700">{packsErr}</div> : null}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                  <th className="py-2 pr-3 font-medium">Pack</th>
                  <th className="py-2 pr-3 font-medium">Price (cents)</th>
                  <th className="py-2 pr-3 font-medium">Currency</th>
                  <th className="py-2 pr-3 font-medium">Credits</th>
                  <th className="py-2 pr-3 font-medium">Active</th>
                  <th className="py-2 pr-3 font-medium">Order</th>
                  <th className="py-2 pr-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {packs.map((p) => {
                  const e = packEdits[p.id] || {};
                  const v = { ...p, ...e };
                  const saving = !!packSaving[p.id];
                  return (
                  <tr key={p.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-3 font-medium text-zinc-900">{p.name}</td>
                    <td className="py-2 pr-3">
                      <input
                        value={String(v.price_cents ?? 0)}
                        onChange={(ev) =>
                          setPackEdits((m) => ({ ...m, [p.id]: { ...(m[p.id] || {}), price_cents: Number(ev.target.value) } }))
                        }
                        className="w-28 rounded-lg border border-zinc-300 px-2 py-1 text-xs font-mono"
                        inputMode="numeric"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        value={String(v.currency ?? "eur").toUpperCase()}
                        onChange={(ev) =>
                          setPackEdits((m) => ({
                            ...m,
                            [p.id]: { ...(m[p.id] || {}), currency: ev.target.value.trim().toLowerCase() },
                          }))
                        }
                        className="w-20 rounded-lg border border-zinc-300 px-2 py-1 text-xs font-mono"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        value={String(v.report_credits ?? 0)}
                        onChange={(ev) =>
                          setPackEdits((m) => ({
                            ...m,
                            [p.id]: { ...(m[p.id] || {}), report_credits: Number(ev.target.value) },
                          }))
                        }
                        className="w-24 rounded-lg border border-zinc-300 px-2 py-1 text-xs font-mono"
                        inputMode="numeric"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="checkbox"
                        checked={!!v.active}
                        onChange={(ev) =>
                          setPackEdits((m) => ({ ...m, [p.id]: { ...(m[p.id] || {}), active: ev.target.checked } }))
                        }
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        value={String(v.sort_order ?? 0)}
                        onChange={(ev) =>
                          setPackEdits((m) => ({
                            ...m,
                            [p.id]: { ...(m[p.id] || {}), sort_order: Number(ev.target.value) },
                          }))
                        }
                        className="w-20 rounded-lg border border-zinc-300 px-2 py-1 text-xs font-mono"
                        inputMode="numeric"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          void (async () => {
                            const patch = packEdits[p.id] || {};
                            setPackSaving((s) => ({ ...s, [p.id]: true }));
                            try {
                              const res = await fetch("/api/saas-owner/packs", {
                                method: "PATCH",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({ id: p.id, ...patch }),
                              });
                              const data = await res.json().catch(() => ({}));
                              if (!res.ok) throw new Error(data.error || "Failed");
                              await refreshPacks();
                              setPackEdits((m) => ({ ...m, [p.id]: {} }));
                            } catch (err: unknown) {
                              alert(err instanceof Error ? err.message : "Failed");
                            } finally {
                              setPackSaving((s) => ({ ...s, [p.id]: false }));
                            }
                          })()
                        }
                        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setPackEdits((m) => ({ ...m, [p.id]: {} }))}
                        className="ml-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                      >
                        Reset
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-zinc-900">Agents</div>
              <div className="mt-1 text-xs text-zinc-500">Create unique agent links and control commission + active status.</div>
            </div>
            <button
              type="button"
              onClick={() => void refreshAgents()}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              {agentsBusy ? "Refreshing…" : "Refresh agents"}
            </button>
          </div>
          {agentsErr ? <div className="mt-3 text-sm text-red-700">{agentsErr}</div> : null}

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <label className="text-sm">
              <span className="text-zinc-600">Agent email</span>
              <input
                value={newAgentEmail}
                onChange={(e) => setNewAgentEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                placeholder="agent@example.com"
              />
            </label>
            <label className="text-sm">
              <span className="text-zinc-600">Display name</span>
              <input
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                placeholder="Optional"
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() =>
                  void (async () => {
                    try {
                      const res = await fetch("/api/saas-owner/agents", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ agent_email: newAgentEmail, display_name: newAgentName }),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error(data.error || "Failed");
                      setNewAgentEmail("");
                      setNewAgentName("");
                      await refreshAgents();
                    } catch (e: unknown) {
                      alert(e instanceof Error ? e.message : "Failed");
                    }
                  })()
                }
                className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Create agent link
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                  <th className="py-2 pr-3 font-medium">Code</th>
                  <th className="py-2 pr-3 font-medium">Agent</th>
                  <th className="py-2 pr-3 font-medium">Active</th>
                  <th className="py-2 pr-3 font-medium">Commission %</th>
                  <th className="py-2 pr-3 font-medium">Payout wait (days)</th>
                  <th className="py-2 pr-3 font-medium">Inactive after (days)</th>
                  <th className="py-2 pr-3 font-medium">Link</th>
                  <th className="py-2 pr-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => {
                  const e = agentEdits[a.code] || {};
                  const v = { ...a, ...e };
                  const saving = !!agentSaving[a.code];
                  const pct = ((Number(v.commission_bps ?? 0) || 0) / 100).toFixed(2);
                  return (
                  <tr key={a.code} className="border-b border-zinc-100">
                    <td className="py-2 pr-3 font-mono text-xs">{a.code}</td>
                    <td className="py-2 pr-3 text-xs">{a.agent_email}</td>
                    <td className="py-2 pr-3">
                      <input
                        type="checkbox"
                        checked={!!v.active}
                        onChange={(ev) =>
                          setAgentEdits((m) => ({ ...m, [a.code]: { ...(m[a.code] || {}), active: ev.target.checked } }))
                        }
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        value={pct}
                        onChange={(ev) => {
                          const n = Number(ev.target.value);
                          const bps = Number.isFinite(n) ? Math.round(n * 100) : 0;
                          setAgentEdits((m) => ({ ...m, [a.code]: { ...(m[a.code] || {}), commission_bps: bps } }));
                        }}
                        className="w-24 rounded-lg border border-zinc-300 px-2 py-1 text-xs font-mono"
                        inputMode="decimal"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        value={String((v as any).payout_wait_days ?? 21)}
                        onChange={(ev) =>
                          setAgentEdits((m) => ({
                            ...m,
                            [a.code]: { ...(m[a.code] || {}), payout_wait_days: Number(ev.target.value) as any },
                          }))
                        }
                        className="w-24 rounded-lg border border-zinc-300 px-2 py-1 text-xs font-mono"
                        inputMode="numeric"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        value={String(v.inactive_after_days ?? 400)}
                        onChange={(ev) =>
                          setAgentEdits((m) => ({
                            ...m,
                            [a.code]: { ...(m[a.code] || {}), inactive_after_days: Number(ev.target.value) },
                          }))
                        }
                        className="w-28 rounded-lg border border-zinc-300 px-2 py-1 text-xs font-mono"
                        inputMode="numeric"
                      />
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      <span className="font-mono">{`/landing.html?ref=${a.code}`}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          void (async () => {
                            const patch = agentEdits[a.code] || {};
                            setAgentSaving((s) => ({ ...s, [a.code]: true }));
                            try {
                              const res = await fetch("/api/saas-owner/agents", {
                                method: "PATCH",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({ code: a.code, ...patch }),
                              });
                              const data = await res.json().catch(() => ({}));
                              if (!res.ok) throw new Error(data.error || "Failed");
                              await refreshAgents();
                              setAgentEdits((m) => ({ ...m, [a.code]: {} }));
                            } catch (err: unknown) {
                              alert(err instanceof Error ? err.message : "Failed");
                            } finally {
                              setAgentSaving((s) => ({ ...s, [a.code]: false }));
                            }
                          })()
                        }
                        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setAgentEdits((m) => ({ ...m, [a.code]: {} }))}
                        className="ml-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                      >
                        Reset
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-zinc-900">Referral earnings</div>
              <div className="mt-1 text-xs text-zinc-500">View pending/eligible/paid referral commission and control payouts.</div>
            </div>
            <button
              type="button"
              onClick={() => void refreshEarnings()}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              {earnBusy ? "Refreshing…" : "Refresh earnings"}
            </button>
          </div>
          {earnErr ? <div className="mt-3 text-sm text-red-700">{earnErr}</div> : null}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="text-sm">
              <span className="text-zinc-600">Agent email (optional)</span>
              <input
                value={earnAgentFilter}
                onChange={(e) => setEarnAgentFilter(e.target.value)}
                className="mt-1 rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                placeholder="agent@example.com"
              />
            </label>
            <label className="text-sm">
              <span className="text-zinc-600">Status</span>
              <select
                value={earnStatus}
                onChange={(e) => setEarnStatus(e.target.value as any)}
                className="mt-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="eligible">Eligible</option>
                <option value="paid">Paid</option>
                <option value="void">Void</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => void refreshEarnings()}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Apply filters
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                  <th className="py-2 pr-3 font-medium">Agent</th>
                  <th className="py-2 pr-3 font-medium">Tenant</th>
                  <th className="py-2 pr-3 font-medium">Amount</th>
                  <th className="py-2 pr-3 font-medium">Commission</th>
                  <th className="py-2 pr-3 font-medium">Eligible at</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {earnings.map((e) => (
                  <tr key={e.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-3 text-xs">{e.agent_email}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{e.tenant_id ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs">{fmtMoney(e.amount_cents, (e.currency || "eur").toUpperCase())}</td>
                    <td className="py-2 pr-3 text-xs">{fmtMoney(e.commission_cents, (e.currency || "eur").toUpperCase())}</td>
                    <td className="py-2 pr-3 text-xs">{new Date(e.eligible_at).toLocaleString()}</td>
                    <td className="py-2 pr-3 text-xs">{String(e.computed_status || e.status)}</td>
                    <td className="py-2 pr-3 text-xs">
                      <button
                        type="button"
                        onClick={() =>
                          void (async () => {
                            const next = prompt("Set status: pending | eligible | paid | void", String(e.status)) || "";
                            if (!next) return;
                            try {
                              const res = await fetch("/api/saas-owner/referrals/earnings", {
                                method: "PATCH",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({ id: e.id, status: next }),
                              });
                              const data = await res.json().catch(() => ({}));
                              if (!res.ok) throw new Error(data.error || "Failed");
                              await refreshEarnings();
                            } catch (err: unknown) {
                              alert(err instanceof Error ? err.message : "Failed");
                            }
                          })()
                        }
                        className="text-xs font-semibold text-emerald-700 hover:underline"
                      >
                        Change status
                      </button>
                    </td>
                  </tr>
                ))}
                {earnings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-4 text-sm text-zinc-500">
                      No earnings yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-zinc-900">OpenAI</div>
              <div className="mt-1 text-xs text-zinc-500">
                Real-time balance isn’t available via API secret keys; this shows spend based on logged usage events.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSpendTick((n) => n + 1);
                }}
                disabled={spendBusy}
                className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-emerald-100 disabled:opacity-50"
              >
                {spendBusy ? "Refreshing…" : "Refresh OpenAI data"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSpendErr(null);
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

