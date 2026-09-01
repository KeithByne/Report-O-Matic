-- Per-school timetable display: overview pagination size and grid row density.
alter table public.tenants
  add column if not exists timetable_overview_rooms_per_page int not null default 5,
  add column if not exists timetable_display_density text not null default 'comfortable';

alter table public.tenants drop constraint if exists tenants_timetable_overview_rooms_per_page_check;
alter table public.tenants
  add constraint tenants_timetable_overview_rooms_per_page_check
  check (timetable_overview_rooms_per_page >= 1 and timetable_overview_rooms_per_page <= 10);

alter table public.tenants drop constraint if exists tenants_timetable_display_density_check;
alter table public.tenants
  add constraint tenants_timetable_display_density_check
  check (timetable_display_density in ('comfortable', 'compact'));
