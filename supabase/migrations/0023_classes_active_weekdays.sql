-- Days of the week the class meets (JSON array of stable keys: mon, tue, wed, thu, fri, sat, sun).
alter table public.classes
  add column if not exists active_weekdays jsonb not null default '[]'::jsonb;

comment on column public.classes.active_weekdays is 'Ordered subset of weekday keys (mon…sun) when the class is active; used for attendance register PDF.';
