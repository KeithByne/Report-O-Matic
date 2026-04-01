"use client";

import { useEffect, useMemo, useState } from "react";
import { AppHeaderLogo, AppHeaderWordmark } from "@/components/layout/AppHeaderBrand";
import { GlobeLanguageSwitcher } from "@/components/i18n/GlobeLanguageSwitcher";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";

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
  const { t } = useUiLanguage();
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
          <div className="flex items-start gap-3">
            <AppHeaderLogo />
            <div>
              <AppHeaderWordmark />
              <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{t("saas.platformBadge")}</div>
              <div className="mt-1 text-lg font-semibold tracking-tight">{t("saas.ownerDashboardTitle")}</div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
            <GlobeLanguageSwitcher />
            <div className="text-xs text-zinc-500">
              {t("dash.signedInAs")} <span className="font-mono text-zinc-800">{viewerEmail}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-5 py-6">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-zinc-900">{t("saas.creditPacksTitle")}</div>
              <div className="mt-1 text-xs text-zinc-500">{t("saas.creditPacksLead")}</div>
            </div>
            <button
              type="button"
              onClick={() => void refreshPacks()}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              {packsBusy ? t("dash.agentRefreshing") : t("saas.refreshPacks")}
            </button>
          </div>
          {packsErr ? <div className="mt-3 text-sm text-red-700">{packsErr}</div> : null}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                  <th className="py-2 pr-3 font-medium">{t("saas.thPack")}</th>
                  <th className="py-2 pr-3 font-medium">{t("saas.thPriceCents")}</th>
                  <th className="py-2 pr-3 font-medium">{t("saas.thCurrency")}</th>
                  <th className="py-2 pr-3 font-medium">{t("saas.thCredits")}</th>
                  <th className="py-2 pr-3 font-medium">{t("saas.thActive")}</th>
                  <th className="py-2 pr-3 font-medium">{t("saas.thSortOrder")}</th>
                  <th className="py-2 pr-3 font-medium">{t("roster.thActions")}</th>
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
                              alert(err instanceof Error ? err.message : t("common.failed"));
                            } finally {
                              setPackSaving((s) => ({ ...s, [p.id]: false }));
                            }
                          })()
                        }
                        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {saving ? t("dash.agentSaving") : t("dash.agentSave")}
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setPackEdits((m) => ({ ...m, [p.id]: {} }))}
                        className="ml-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                      >
                        {t("dash.agentReset")}
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
              <div className="text-sm font-semibold text-zinc-900">{t("saas.agentsTitle")}</div>
              <div className="mt-1 text-xs text-zinc-500">{t("saas.agentsLead")}</div>
            </div>
            <button
              type="button"
              onClick={() => void refreshAgents()}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              {agentsBusy ? t("dash.agentRefreshing") : t("saas.refreshAgents")}
            </button>
          </div>
          {agentsErr ? <div className="mt-3 text-sm text-red-700">{agentsErr}</div> : null}

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <label className="text-sm">
              <span className="text-zinc-600">{t("saas.agentEmailLabel")}</span>
              <input
                value={newAgentEmail}
                onChange={(e) => setNewAgentEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                placeholder={t("saas.placeholderAgentEmail")}
              />
            </label>
            <label className="text-sm">
              <span className="text-zinc-600">{t("saas.displayNameLabel")}</span>
              <input
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                placeholder={t("saas.optionalPlaceholder")}
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
                      alert(e instanceof Error ? e.message : t("common.failed"));
                    }
                  })()
                }
                className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
              >
                {t("saas.createAgentLink")}
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                  <th className="py-2 pr-3 font-medium">{t("saas.thCode")}</th>
                  <th className="py-2 pr-3 font-medium">{t("saas.thAgent")}</th>
                  <th className="py-2 pr-3 font-medium">{t("saas.thActive")}</th>
                  <th className="py-2 pr-3 font-medium">{t("saas.thCommissionPct")}</th>
                  <th className="py-2 pr-3 font-medium">{t("saas.thPayoutWaitDays")}</th>
                  <th className="py-2 pr-3 font-medium">{t("saas.thInactiveAfterDays")}</th>
                  <th className="py-2 pr-3 font-medium">{t("saas.thLink")}</th>
                  <th className="py-2 pr-3 font-medium">{t("roster.thActions")}</th>
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
                              alert(err instanceof Error ? err.message : t("common.failed"));
                            } finally {
                              setAgentSaving((s) => ({ ...s, [a.code]: false }));
                            }
                          })()
                        }
                        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {saving ? t("dash.agentSaving") : t("dash.agentSave")}
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setAgentEdits((m) => ({ ...m, [a.code]: {} }))}
                        className="ml-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                      >
                        {t("dash.agentReset")}
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
              <div className="text-sm font-semibold text-zinc-900">{t("saas.referralEarningsTitle")}</div>
              <div className="mt-1 text-xs text-zinc-500">{t("saas.referralEarningsLead")}</div>
            </div>
            <button
              type="button"
              onClick={() => void refreshEarnings()}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              {earnBusy ? t("dash.agentRefreshing") : t("saas.refreshEarnings")}
            </button>
          </div>
          {earnErr ? <div className="mt-3 text-sm text-red-700">{earnErr}</div> : null}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="text-sm">
              <span className="text-zinc-600">{t("saas.agentEmailOptional")}</span>
              <input
                value={earnAgentFilter}
                onChange={(e) => setEarnAgentFilter(e.target.value)}
                className="mt-1 rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                placeholder={t("saas.placeholderAgentEmail")}
              />
            </label>
            <label className="text-sm">
              <span className="text-zinc-600">{t("saas.statusLabel")}</span>
              <select
                value={earnStatus}
                onChange={(e) => setEarnStatus(e.target.value as any)}
                className="mt-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">{t("saas.statusAll")}</option>
                <option value="pending">{t("saas.statusPending")}</option>
                <option value="eligible">{t("saas.statusEligible")}</option>
                <option value="paid">{t("saas.statusPaid")}</option>
                <option value="void">{t("saas.statusVoid")}</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => void refreshEarnings()}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
            >
              {t("saas.applyFilters")}
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                  <th className="py-2 pr-3 font-medium">{t("saas.thAgent")}</th>
                  <th className="py-2 pr-3 font-medium">{t("saas.thTenant")}</th>
                  <th className="py-2 pr-3 font-medium">{t("saas.thAmount")}</th>
                  <th className="py-2 pr-3 font-medium">{t("saas.thCommission")}</th>
                  <th className="py-2 pr-3 font-medium">{t("saas.thEligibleAt")}</th>
                  <th className="py-2 pr-3 font-medium">{t("saas.statusLabel")}</th>
                  <th className="py-2 pr-3 font-medium">{t("roster.thActions")}</th>
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
                            const next = prompt(t("saas.promptSetStatus"), String(e.status)) || "";
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
                              alert(err instanceof Error ? err.message : t("common.failed"));
                            }
                          })()
                        }
                        className="text-xs font-semibold text-emerald-700 hover:underline"
                      >
                        {t("saas.changeStatus")}
                      </button>
                    </td>
                  </tr>
                ))}
                {earnings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-4 text-sm text-zinc-500">
                      {t("saas.noEarningsYet")}
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
              <div className="text-sm font-semibold text-zinc-900">{t("saas.openAiTitle")}</div>
              <div className="mt-1 text-xs text-zinc-500">{t("saas.openAiLead")}</div>
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
                {spendBusy ? t("dash.agentRefreshing") : t("saas.refreshOpenAi")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSpendErr(null);
                }}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                {t("saas.clearErrors")}
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="text-sm">
              <span className="text-zinc-600">{t("saas.rangeLabel")}</span>
              <select
                value={spendRange}
                onChange={(e) => setSpendRange(e.target.value as typeof spendRange)}
                className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm"
              >
                <option value="day">{t("saas.rangeDay")}</option>
                <option value="week">{t("saas.rangeWeek")}</option>
                <option value="month">{t("saas.rangeMonth")}</option>
                <option value="year">{t("saas.rangeYear")}</option>
                <option value="ytd">{t("saas.rangeYtd")}</option>
                <option value="all">{t("saas.rangeAll")}</option>
              </select>
            </label>
            <a
              href="https://platform.openai.com/settings/organization/billing/overview"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              {t("saas.openAiBillingLink")}
            </a>
          </div>

          {spendErr ? <div className="mt-3 text-sm text-red-700">{spendErr}</div> : null}
          {spend ? (
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{t("saas.estimatedSpend")}</div>
                <div className="mt-1 text-lg font-semibold text-zinc-900">
                  {fmtUsdPrecise(spend.totals.est_cost_usd)}
                </div>
                <div className="mt-1 text-xs text-zinc-500">{t("saas.requestsCount", { n: spend.totals.requests })}</div>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{t("saas.tokens")}</div>
                <div className="mt-1 text-sm font-semibold text-zinc-900">{spend.totals.total_tokens.toLocaleString()}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  {t("saas.tokensPromptCompletion", {
                    prompt: spend.totals.prompt_tokens.toLocaleString(),
                    completion: spend.totals.completion_tokens.toLocaleString(),
                  })}
                </div>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{t("saas.byKind")}</div>
                <div className="mt-1 text-xs text-zinc-700">
                  {t("saas.kindDraft", {
                    req: spend.totals.by_kind.draft.requests,
                    cost: fmtUsdPrecise(spend.totals.by_kind.draft.est_cost_usd),
                  })}
                </div>
                <div className="mt-1 text-xs text-zinc-700">
                  {t("saas.kindTranslate", {
                    req: spend.totals.by_kind.translate.requests,
                    cost: fmtUsdPrecise(spend.totals.by_kind.translate.est_cost_usd),
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3 text-sm text-zinc-600">{spendBusy ? t("dash.agentLoading") : "—"}</div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full">
              <div className="text-sm font-semibold text-zinc-900">{t("saas.financeTitle")}</div>
              <div className="mt-1 text-xs text-zinc-500">{t("saas.financeLead")}</div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                <label className="text-sm">
                  <span className="text-zinc-600">{t("saas.rangeLabel")}</span>
                  <select
                    value={range}
                    onChange={(e) => setRange(e.target.value as typeof range)}
                    className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="day">{t("saas.rangeDay")}</option>
                    <option value="week">{t("saas.rangeWeek")}</option>
                    <option value="month">{t("saas.rangeMonth")}</option>
                    <option value="year">{t("saas.rangeYear")}</option>
                    <option value="ytd">{t("saas.rangeYtd")}</option>
                    <option value="all">{t("saas.rangeAll")}</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className="text-zinc-600">{t("saas.agentOptional")}</span>
                  <input
                    value={agentFilter}
                    onChange={(e) => setAgentFilter(e.target.value)}
                    placeholder={t("saas.agentFilterPlaceholder")}
                    className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <div className="text-sm text-zinc-600">{finBusy ? t("dash.agentLoading") : ""}</div>
              </div>
            </div>
          </div>
          {finErr ? <div className="mt-3 text-sm text-red-700">{finErr}</div> : null}
          {fin ? (
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{t("saas.paidToSaaS")}</div>
                <div className="mt-1 text-lg font-semibold text-zinc-900">{fmtMoney(fin.payments_in.amount_cents)}</div>
                <div className="mt-1 text-xs text-zinc-500">{t("saas.paymentsCount", { n: fin.payments_in.count })}</div>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{t("saas.paidToAgents")}</div>
                <div className="mt-1 text-lg font-semibold text-zinc-900">{fmtMoney(fin.agent_payouts_out.amount_cents)}</div>
                <div className="mt-1 text-xs text-zinc-500">{t("saas.payoutsCount", { n: fin.agent_payouts_out.count })}</div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full">
              <label className="text-sm font-medium text-zinc-800">{t("saas.searchSchoolsLabel")}</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("saas.searchPlaceholder")}
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-400"
              />
              <div className="mt-2 text-xs text-zinc-500">{t("saas.searchHint")}</div>
            </div>
            <div className="text-sm text-zinc-600">{busy ? t("dash.agentLoading") : t("saas.resultsCount", { n: hits.length })}</div>
          </div>
          {err ? <div className="mt-3 text-sm text-red-700">{err}</div> : null}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-zinc-900">{t("saas.schoolsTitle")}</div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                  <th className="py-2 pr-3 font-medium">{t("saas.thTenant")}</th>
                  <th className="py-2 pr-3 font-medium">{t("saas.thTenantId")}</th>
                  <th className="py-2 pr-3 font-medium">{t("saas.thOwners")}</th>
                  <th className="py-2 pr-3 font-medium">{t("roster.thActions")}</th>
                </tr>
              </thead>
              <tbody>
                {hits.map((row) => (
                  <tr key={row.tenant_id} className="border-b border-zinc-100">
                    <td className="py-2 pr-3 font-medium text-zinc-900">{row.tenant_name}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-zinc-700">{row.tenant_id}</td>
                    <td className="py-2 pr-3 text-xs text-zinc-700">
                      {row.owner_emails.length ? row.owner_emails.join(", ") : "—"}
                    </td>
                    <td className="py-2 pr-3">
                      <a
                        href={`/saas-owner/tenants/${encodeURIComponent(row.tenant_id)}`}
                        className="text-xs font-semibold text-emerald-700 hover:underline"
                      >
                        {t("saas.viewSchool")}
                      </a>
                      <span className="mx-2 text-xs text-zinc-300">|</span>
                      <a
                        href={`/api/tenants/${encodeURIComponent(row.tenant_id)}/export`}
                        className="text-xs font-semibold text-emerald-700 hover:underline"
                      >
                        {t("saas.exportExcel")}
                      </a>
                    </td>
                  </tr>
                ))}
                {hits.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-sm text-zinc-500">
                      {t("saas.noSearchResults")}
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

