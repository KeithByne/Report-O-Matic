-- Default report kind for new reports created from the class workspace (standard vs short course).

alter table public.classes
  add column if not exists default_new_report_kind text not null default 'standard'
  check (default_new_report_kind in ('standard', 'short_course'));

comment on column public.classes.default_new_report_kind is
  'New reports from class pupil list use this kind until changed in class settings.';
