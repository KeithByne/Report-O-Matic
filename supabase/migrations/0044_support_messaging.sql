-- In-app customer support: one thread per signed-in user, two-way messages with SaaS owner.

create table if not exists public.support_threads (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  display_name text,
  tenant_id uuid references public.tenants (id) on delete set null,
  tenant_name_snapshot text,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  owner_last_read_at timestamptz not null default now(),
  user_last_read_at timestamptz not null default now(),
  constraint support_threads_user_email_unique unique (user_email)
);

create index if not exists support_threads_updated_idx on public.support_threads (updated_at desc);
create index if not exists support_threads_user_email_idx on public.support_threads (lower(user_email));

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads (id) on delete cascade,
  sender_role text not null check (sender_role in ('user', 'owner')),
  sender_email text not null,
  body text not null check (char_length(trim(body)) >= 1 and char_length(body) <= 4000),
  created_at timestamptz not null default now()
);

create index if not exists support_messages_thread_created_idx
  on public.support_messages (thread_id, created_at asc);

alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;
