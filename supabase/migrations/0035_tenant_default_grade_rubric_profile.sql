-- School-wide education type preset used for new classes.
alter table public.tenants
  add column if not exists default_grade_rubric_profile text not null default 'language';

alter table public.tenants
  drop constraint if exists tenants_default_grade_rubric_profile_check;

alter table public.tenants
  add constraint tenants_default_grade_rubric_profile_check
  check (default_grade_rubric_profile in ('language', 'primary', 'secondary'));
