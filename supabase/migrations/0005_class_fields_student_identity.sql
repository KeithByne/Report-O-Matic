-- Class-level defaults (report language, subject, scholastic year, CEFR).
-- Student identity fields for Report dataset 4 (names + gender).

alter table public.classes
  add column if not exists scholastic_year text;

alter table public.classes
  add column if not exists cefr_level text;

alter table public.classes
  add column if not exists default_subject text not null default 'efl';

alter table public.classes
  add column if not exists default_output_language text not null default 'en';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'classes_cefr_level_check'
  ) then
    alter table public.classes
      add constraint classes_cefr_level_check
      check (cefr_level is null or cefr_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));
  end if;
end $$;

alter table public.students
  add column if not exists first_name text;

alter table public.students
  add column if not exists last_name text;

alter table public.students
  add column if not exists gender text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'students_gender_check'
  ) then
    alter table public.students
      add constraint students_gender_check
      check (gender is null or gender in ('male', 'female', 'non_binary'));
  end if;
end $$;

update public.students
set
  first_name = coalesce(
    nullif(trim(split_part(trim(display_name), ' ', 1)), ''),
    '-'
  ),
  last_name = case
    when strpos(trim(display_name), ' ') > 0 then
      trim(substring(trim(display_name) from strpos(trim(display_name), ' ') + 1))
    else '-'
  end
where first_name is null or last_name is null;

-- Primary teacher assigned to the class (department head / owner). Teachers only see classes assigned to them.
alter table public.classes
  add column if not exists assigned_teacher_email text;

create index if not exists classes_assigned_teacher_lower_idx
  on public.classes (tenant_id, lower(assigned_teacher_email));
