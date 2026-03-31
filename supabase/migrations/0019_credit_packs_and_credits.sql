-- Credit packs + tenant credit ledger.
-- RLS enabled with no policies so only the service role can access.

create table if not exists public.credit_packs (
  id text primary key,
  name text not null,
  price_cents int not null check (price_cents >= 0),
  currency text not null,
  report_credits int not null check (report_credits >= 0),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.credit_packs enable row level security;

-- Seed default pack types (id is stable).
insert into public.credit_packs (id, name, price_cents, currency, report_credits, active, sort_order)
values
  ('tester', 'Tester Pack', 500, 'eur', 50, true, 10),
  ('economy', 'Economy Pack', 2500, 'eur', 250, true, 20),
  ('school', 'School Pack', 5000, 'eur', 600, true, 30),
  ('large_school', 'Large School Pack', 10000, 'eur', 1300, true, 40),
  ('universal_school', 'Universal School Pack', 50000, 'eur', 6000, true, 50)
on conflict (id) do nothing;

create table if not exists public.tenant_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  delta_credits int not null,
  reason text not null check (reason in ('purchase', 'consume', 'manual_adjust')),
  report_id uuid references public.reports (id) on delete set null,
  stripe_event_id text,
  created_at timestamptz not null default now(),
  unique (tenant_id, report_id, reason)
);

create index if not exists tenant_credit_ledger_tenant_idx on public.tenant_credit_ledger (tenant_id, created_at desc);
alter table public.tenant_credit_ledger enable row level security;

