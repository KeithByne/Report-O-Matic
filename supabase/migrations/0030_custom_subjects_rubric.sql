-- Structured custom subjects: name + grade rubric profile (language / primary / secondary).
alter table public.tenants
  add column if not exists custom_subjects jsonb not null default '[]';

-- Migrate legacy text[] entries to JSON rows (default rubric: secondary).
update public.tenants t
set custom_subjects = coalesce(
  (
    select jsonb_agg(jsonb_build_object('name', trim(x), 'rubric_profile', 'secondary'))
    from unnest(t.custom_subject_names) as x
    where trim(x) <> ''
  ),
  '[]'::jsonb
)
where exists (
  select 1
  from unnest(coalesce(t.custom_subject_names, array[]::text[])) as u(v)
  where trim(u.v) <> ''
);

alter table public.tenants drop column if exists custom_subject_names;
