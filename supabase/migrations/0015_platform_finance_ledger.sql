-- Platform-level finance ledger for SaaS-owner dashboard.
-- Stores derived rows from Stripe webhooks: payments in + agent payouts out.
-- RLS enabled with no policies so only the service role can access.

create table if not exists public.platform_payments (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null,
  customer_email text,
  description text,
  created_at timestamptz not null
);

create index if not exists platform_payments_created_idx on public.platform_payments (created_at desc);
create index if not exists platform_payments_email_idx on public.platform_payments (lower(customer_email));

create table if not exists public.agent_payouts (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  stripe_transfer_id text,
  stripe_payout_id text,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null,
  agent_account text not null, -- email or other identifier you choose
  memo text,
  created_at timestamptz not null
);

create index if not exists agent_payouts_created_idx on public.agent_payouts (created_at desc);
create index if not exists agent_payouts_account_idx on public.agent_payouts (lower(agent_account));

alter table public.platform_payments enable row level security;
alter table public.agent_payouts enable row level security;

