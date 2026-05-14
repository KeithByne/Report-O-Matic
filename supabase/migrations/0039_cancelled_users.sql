-- Emails that completed account erasure (self-service or SaaS owner). Re-sign-in / re-sign-up is blocked
-- until SaaS owner clears `reaccess_blocked`.
create table if not exists public.cancelled_users (
  email text primary key,
  cancelled_at timestamptz not null default now(),
  cancelled_by_email text,
  source text not null check (source in ('self', 'saas_owner')),
  snapshot jsonb,
  reaccess_blocked boolean not null default true,
  reaccess_attempt_count integer not null default 0,
  last_reaccess_attempt_at timestamptz
);

create index if not exists cancelled_users_blocked_idx
  on public.cancelled_users (reaccess_blocked)
  where reaccess_blocked = true;

-- Avoid "DESC NULLS LAST" in index definition: some Postgres builds reject it and abort the migration
-- before RLS runs (error text often points at the following statement).
create index if not exists cancelled_users_last_attempt_idx
  on public.cancelled_users (last_reaccess_attempt_at desc);

alter table public.cancelled_users enable row level security;
