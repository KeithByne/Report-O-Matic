-- Per-tenant list of user-defined subject names (for class default subject picker).
alter table public.tenants
  add column if not exists custom_subject_names text[] not null default '{}';
