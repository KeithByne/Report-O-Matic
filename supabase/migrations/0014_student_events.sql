-- Audit trail for student lifecycle changes (added/deleted/moved between classes).
-- RLS enabled with no policies so only the service role can access.

create table if not exists public.student_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  actor_email text not null,
  event_type text not null check (event_type in ('added', 'deleted', 'moved')),
  student_id uuid,
  from_class_id uuid,
  to_class_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists student_events_tenant_idx on public.student_events (tenant_id);
create index if not exists student_events_actor_idx on public.student_events (tenant_id, lower(actor_email));
create index if not exists student_events_created_idx on public.student_events (tenant_id, created_at);

alter table public.student_events enable row level security;

