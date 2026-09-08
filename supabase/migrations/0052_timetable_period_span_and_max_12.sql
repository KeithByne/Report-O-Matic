-- Raise AM/PM teaching-period caps to 12; support multi-period lessons via lesson_block_id.

alter table public.tenants drop constraint if exists tenants_timetable_periods_am_check;
alter table public.tenants
  add constraint tenants_timetable_periods_am_check
  check (timetable_periods_am >= 1 and timetable_periods_am <= 12);

alter table public.tenants drop constraint if exists tenants_timetable_periods_pm_check;
alter table public.tenants
  add constraint tenants_timetable_periods_pm_check
  check (timetable_periods_pm >= 1 and timetable_periods_pm <= 12);

-- Shared id for consecutive period rows that form one longer lesson (null = single period).
alter table public.timetable_slots
  add column if not exists lesson_block_id uuid;

create index if not exists timetable_slots_lesson_block_idx
  on public.timetable_slots (tenant_id, lesson_block_id)
  where lesson_block_id is not null;
