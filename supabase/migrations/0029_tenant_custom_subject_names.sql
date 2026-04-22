-- Per-tenant custom subject names (typed in class settings; merged on save).
alter table public.tenants
  add column if not exists custom_subject_names text[] not null default '{}';
