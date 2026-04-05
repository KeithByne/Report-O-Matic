-- Default report period (term focus) for new standard reports created from this class.

alter table public.classes
  add column if not exists default_new_report_period text not null default 'first'
  check (default_new_report_period in ('first', 'second', 'third'));

comment on column public.classes.default_new_report_period is
  'Default inputs.report_period for new standard reports (first / second / third term).';
