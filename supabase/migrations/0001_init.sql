-- Report-O-Matic: initial tables (run in Supabase SQL Editor or via CLI)
-- Service-role API routes bypass RLS; anon/authenticated have no policies yet (no access).

create extension if not exists "pgcrypto";

-- OTP challenges for email sign-in (hashed codes only; never store plaintext OTP)
create table public.otp_challenges (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  mode text not null check (mode in ('signin', 'signup')),
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

create index otp_challenges_email_idx on public.otp_challenges (email);
create index otp_challenges_expires_at_idx on public.otp_challenges (expires_at);

alter table public.otp_challenges enable row level security;

-- Multi-tenant foundation (RLS policies added in a later migration)
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_email text not null,
  role text not null check (role in ('owner', 'department_head', 'teacher')),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_email)
);

create index memberships_tenant_idx on public.memberships (tenant_id);
create index memberships_email_idx on public.memberships (lower(user_email));

alter table public.tenants enable row level security;
alter table public.memberships enable row level security;
