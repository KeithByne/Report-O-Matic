-- Class-level educational context for level bands (CEFR vs year) and report rubrics.
alter table public.classes
  add column if not exists grade_rubric_profile text not null default 'language';

alter table public.classes
  drop constraint if exists classes_grade_rubric_profile_check;

alter table public.classes
  add constraint classes_grade_rubric_profile_check
  check (grade_rubric_profile in ('language', 'primary', 'secondary'));
