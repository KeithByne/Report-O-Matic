-- Timetable: per-school room/period settings on tenants; slot grid in timetable_slots.

alter table public.tenants
  add column if not exists timetable_room_count int not null default 4,
  add column if not exists timetable_periods_am int not null default 4,
  add column if not exists timetable_periods_pm int not null default 4;

alter table public.tenants drop constraint if exists tenants_timetable_room_count_check;
alter table public.tenants
  add constraint tenants_timetable_room_count_check
  check (timetable_room_count >= 1 and timetable_room_count <= 50);

alter table public.tenants drop constraint if exists tenants_timetable_periods_am_check;
alter table public.tenants
  add constraint tenants_timetable_periods_am_check
  check (timetable_periods_am >= 1 and timetable_periods_am <= 6);

alter table public.tenants drop constraint if exists tenants_timetable_periods_pm_check;
alter table public.tenants
  add constraint tenants_timetable_periods_pm_check
  check (timetable_periods_pm >= 1 and timetable_periods_pm <= 6);

create table if not exists public.timetable_slots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  day_of_week smallint not null check (day_of_week >= 0 and day_of_week <= 4),
  period_index int not null check (period_index >= 0 and period_index < 24),
  room_index int not null check (room_index >= 0 and room_index < 64),
  class_id uuid not null references public.classes (id) on delete cascade,
  teacher_email text not null,
  created_at timestamptz not null default now(),
  constraint timetable_slots_room_occupancy unique (tenant_id, day_of_week, period_index, room_index)
);

create unique index if not exists timetable_slots_teacher_period_unique
  on public.timetable_slots (tenant_id, day_of_week, period_index, (lower(trim(teacher_email))));

create index if not exists timetable_slots_tenant_idx on public.timetable_slots (tenant_id);

alter table public.timetable_slots enable row level security;
