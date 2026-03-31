-- Password reset challenges (hashed codes only; never store plaintext OTP)
-- RLS enabled with no policies so only the service role can access.

create table if not exists public.password_reset_challenges (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists password_reset_challenges_email_idx on public.password_reset_challenges (lower(email));
create index if not exists password_reset_challenges_expires_at_idx on public.password_reset_challenges (expires_at);

alter table public.password_reset_challenges enable row level security;

