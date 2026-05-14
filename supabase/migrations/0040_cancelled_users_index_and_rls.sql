-- Repair / complete cancelled_users if 0039 stopped before RLS (common: index syntax issue).
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

drop index if exists public.cancelled_users_last_attempt_idx;

create index if not exists cancelled_users_last_attempt_idx
  on public.cancelled_users (last_reaccess_attempt_at desc);

alter table public.cancelled_users enable row level security;
