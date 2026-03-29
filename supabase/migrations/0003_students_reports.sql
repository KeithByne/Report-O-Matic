-- Students and report drafts per tenant (service-role API enforces access until RLS policies exist).

create table public.students (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  display_name text not null,
  class_name text,
  created_at timestamptz not null default now()
);

create index students_tenant_idx on public.students (tenant_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  author_email text not null,
  title text,
  body text not null default '',
  status text not null default 'draft' check (status in ('draft', 'final')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reports_tenant_idx on public.reports (tenant_id);
create index reports_student_idx on public.reports (student_id);
create index reports_author_idx on public.reports (lower(author_email));

alter table public.students enable row level security;
alter table public.reports enable row level security;
