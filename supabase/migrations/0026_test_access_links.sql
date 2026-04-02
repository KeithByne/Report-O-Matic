-- Test access links: issue limited-credit sandbox tenants for external testers.
-- A link creates membership for the claimant email and allows access until credits are exhausted.
--
-- Apply before deploying the app version that uses /api/saas-owner/test-access.

create table if not exists public.test_access_links (
  token text primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  created_by_email text,
  claimed_by_email text,
  claimed_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists test_access_links_tenant_idx on public.test_access_links (tenant_id, created_at desc);
create index if not exists test_access_links_claimed_idx on public.test_access_links (claimed_by_email, claimed_at desc);

alter table public.test_access_links enable row level security;

alter table public.otp_challenges
  add column if not exists test_access_token text;

alter table public.tenants
  add column if not exists is_test_access boolean not null default false,
  add column if not exists test_credits_remaining int,
  add column if not exists test_closed_at timestamptz;

create index if not exists tenants_is_test_access_idx on public.tenants (is_test_access);

