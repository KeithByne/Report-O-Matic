-- Classes (required before students), tenant default report language, structured report inputs.

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index classes_tenant_idx on public.classes (tenant_id);

alter table public.tenants
  add column if not exists default_report_language text not null default 'en';

alter table public.reports
  add column if not exists output_language text not null default 'en';

alter table public.reports
  add column if not exists inputs jsonb not null default '{}'::jsonb;

alter table public.students
  add column if not exists class_id uuid references public.classes (id) on delete restrict;

-- One class per tenant that already has students (migrate off free-text class_name).
insert into public.classes (tenant_id, name)
select distinct s.tenant_id, 'General'
from public.students s
where not exists (
  select 1 from public.classes c where c.tenant_id = s.tenant_id
);

update public.students s
set class_id = (
  select c.id from public.classes c
  where c.tenant_id = s.tenant_id
  order by c.created_at asc
  limit 1
)
where s.class_id is null;

alter table public.students alter column class_id set not null;

alter table public.students drop column if exists class_name;

alter table public.classes enable row level security;
