-- Snapshot of class + students + reports when scholastic year changes (read-only review for all roles).

create table public.class_scholastic_archives (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  scholastic_year_label text not null,
  archived_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create index class_scholastic_archives_class_idx on public.class_scholastic_archives (class_id);
create index class_scholastic_archives_tenant_idx on public.class_scholastic_archives (tenant_id);

alter table public.class_scholastic_archives enable row level security;
