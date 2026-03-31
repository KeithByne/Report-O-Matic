-- Allow per-agent control of payout wait period (defaults to 21 days).

alter table public.agent_links
  add column if not exists payout_wait_days int not null default 21
    check (payout_wait_days >= 0 and payout_wait_days <= 3650);

