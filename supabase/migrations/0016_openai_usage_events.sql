-- Track OpenAI usage per request (tokens, model, estimated cost).
-- RLS enabled with no policies so only the service role can access.

create table if not exists public.openai_usage_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete cascade,
  report_id uuid references public.reports (id) on delete set null,
  actor_email text,
  kind text not null check (kind in ('draft', 'translate')),
  model text not null,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  est_cost_usd numeric(10,6) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists openai_usage_events_tenant_idx on public.openai_usage_events (tenant_id, created_at desc);
create index if not exists openai_usage_events_report_idx on public.openai_usage_events (report_id, created_at desc);
create index if not exists openai_usage_events_actor_idx on public.openai_usage_events (tenant_id, lower(actor_email));

alter table public.openai_usage_events enable row level security;

