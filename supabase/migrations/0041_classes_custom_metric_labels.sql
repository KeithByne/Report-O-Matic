-- Per-class titles for the 16 grade input areas (report form + AI dataset lines).
alter table public.classes
  add column if not exists custom_metric_labels jsonb not null default '{}'::jsonb;
