-- Passwords for login (stored as salted scrypt hashes; never plaintext).
-- RLS enabled with no policies so only the service role can access.

create table if not exists public.auth_passwords (
  email text primary key,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists auth_passwords_email_idx on public.auth_passwords (lower(email));

alter table public.auth_passwords enable row level security;

-- Data API grants. From 30 Oct 2026 Supabase no longer auto-exposes new public tables.
-- This app reaches Postgres only through the service role.
grant select, insert, update, delete on table public.auth_passwords to service_role;
