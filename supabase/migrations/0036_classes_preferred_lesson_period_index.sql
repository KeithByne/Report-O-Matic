-- Preferred timetable lesson period for this class (same index as timetable_slots.period_index:
-- 0 .. periods_am-1 = morning, periods_am .. periods_am+periods_pm-1 = afternoon).
alter table public.classes
  add column if not exists preferred_lesson_period_index int null;

alter table public.classes
  drop constraint if exists classes_preferred_lesson_period_index_check;

alter table public.classes
  add constraint classes_preferred_lesson_period_index_check
  check (
    preferred_lesson_period_index is null
    or (
      preferred_lesson_period_index >= 0
      and preferred_lesson_period_index < 24
    )
  );

comment on column public.classes.preferred_lesson_period_index is
  'Optional teaching period index matching tenant timetable (AM indices first, then PM).';

notify pgrst, 'reload schema';
