-- Track zero-credit owners for reminder emails and eventual inactive cleanup.

create table if not exists public.owner_account_lifecycle (
  owner_email text primary key,
  zero_balance_since timestamptz,
  last_inactivity_reminder_at timestamptz,
  marked_inactive_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists owner_account_lifecycle_zero_balance_idx
  on public.owner_account_lifecycle (zero_balance_since)
  where zero_balance_since is not null and marked_inactive_at is null;

alter table public.owner_account_lifecycle enable row level security;
