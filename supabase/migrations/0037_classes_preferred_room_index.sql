-- Persist timetable room preference on the class (0-based row index; also used when there are no slots yet).
alter table public.classes
  add column if not exists preferred_room_index int null;

alter table public.classes
  drop constraint if exists classes_preferred_room_index_check;

alter table public.classes
  add constraint classes_preferred_room_index_check
  check (
    preferred_room_index is null
    or (
      preferred_room_index >= 0
      and preferred_room_index < 64
    )
  );

comment on column public.classes.preferred_room_index is
  'Preferred timetable room row (0-based). Saved with class settings; existing slots are moved to this room when present.';

notify pgrst, 'reload schema';
