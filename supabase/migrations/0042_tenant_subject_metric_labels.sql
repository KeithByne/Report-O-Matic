-- Per-subject titles for the 8 skill grade areas (reading … reading_comprehension).
-- Keys: built-in subject codes (e.g. efl) or lowercase custom subject names.
alter table public.tenants
  add column if not exists subject_metric_labels jsonb not null default '{}'::jsonb;
