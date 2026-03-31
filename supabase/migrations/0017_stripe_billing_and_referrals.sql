-- Stripe billing + referral tracking.
-- RLS enabled with no policies so only the service role can access.

create table if not exists public.tenant_billing (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  status text not null default 'unpaid' check (status in ('unpaid', 'active', 'past_due', 'canceled')),
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  active_since timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tenant_billing_status_idx on public.tenant_billing (status);
alter table public.tenant_billing enable row level security;

-- Carry referral source for tenant creation.
alter table public.tenants
  add column if not exists referral_code text,
  add column if not exists referred_by_email text;

-- Agent links (owner/agent role concept).
create table if not exists public.agent_links (
  code text primary key,
  agent_email text not null,
  display_name text,
  active boolean not null default true,
  commission_bps int not null default 1000 check (commission_bps >= 0 and commission_bps <= 10000),
  inactive_after_days int not null default 400 check (inactive_after_days >= 1 and inactive_after_days <= 5000),
  last_active_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists agent_links_agent_idx on public.agent_links (lower(agent_email));
alter table public.agent_links enable row level security;

-- Referral earnings become eligible after 21 days.
create table if not exists public.referral_earnings (
  id uuid primary key default gen_random_uuid(),
  agent_code text references public.agent_links (code) on delete set null,
  agent_email text not null,
  tenant_id uuid references public.tenants (id) on delete set null,
  stripe_event_id text not null unique,
  amount_cents int not null check (amount_cents >= 0),
  currency text not null,
  commission_cents int not null check (commission_cents >= 0),
  eligible_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'eligible', 'paid', 'void')),
  created_at timestamptz not null default now()
);

create index if not exists referral_earnings_status_idx on public.referral_earnings (status, eligible_at);
create index if not exists referral_earnings_agent_idx on public.referral_earnings (lower(agent_email));
alter table public.referral_earnings enable row level security;

