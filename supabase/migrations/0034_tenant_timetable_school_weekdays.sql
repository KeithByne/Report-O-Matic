-- Which weekdays appear on the school timetable grid (Mon–Sun); default Mon–Fri.
alter table public.tenants
  add column if not exists timetable_school_weekdays jsonb not null default '["mon","tue","wed","thu","fri"]'::jsonb;
