-- School-wide Active / Inactive student lists (owners & department heads).
--
-- Model:
--   school_students  = one person per tenant (active or inactive archive)
--   students         = class enrollment / placement (unchanged table name; reports still FK here)
--
-- A pupil can appear in multiple classes via multiple students rows sharing school_student_id.
-- Removing from Active list sets school_students.status = 'inactive' and ends all enrollments
-- (enrollment_ended_at) without deleting reports. Re-activate restores status = 'active'.

create table if not exists public.school_students (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  display_name text not null,
  gender text,
  status text not null default 'active',
  inactivated_at timestamptz,
  inactivated_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_students_gender_check
    check (gender is null or gender in ('male', 'female', 'non_binary')),
  constraint school_students_status_check
    check (status in ('active', 'inactive'))
);

comment on table public.school_students is
  'Tenant-wide pupil roster. Active list = status active; inactive archive = status inactive.';

comment on column public.school_students.status is
  'active = on Active Student list; inactive = archived on Inactive Students list';

create index if not exists school_students_tenant_status_idx
  on public.school_students (tenant_id, status);

create index if not exists school_students_tenant_name_idx
  on public.school_students (tenant_id, lower(display_name));

alter table public.school_students enable row level security;

-- Class enrollment rows (existing students table)
alter table public.students
  add column if not exists school_student_id uuid references public.school_students (id) on delete cascade;

alter table public.students
  add column if not exists enrollment_ended_at timestamptz;

comment on column public.students.school_student_id is
  'Links this class placement to the school-wide pupil record';

comment on column public.students.enrollment_ended_at is
  'When set, pupil no longer appears in this class roster; reports for this row are kept';

-- Backfill: one school_students row per existing students row (1:1 today)
do $$
declare
  r record;
  sid uuid;
begin
  for r in
    select
      id,
      tenant_id,
      coalesce(nullif(trim(first_name), ''), '-') as fn,
      coalesce(nullif(trim(last_name), ''), '-') as ln,
      display_name,
      gender,
      created_at
    from public.students
    where school_student_id is null
  loop
    insert into public.school_students (
      tenant_id,
      first_name,
      last_name,
      display_name,
      gender,
      status,
      created_at,
      updated_at
    )
    values (
      r.tenant_id,
      r.fn,
      r.ln,
      r.display_name,
      r.gender,
      'active',
      r.created_at,
      now()
    )
    returning id into sid;

    update public.students
    set school_student_id = sid
    where id = r.id;
  end loop;
end $$;

alter table public.students
  alter column school_student_id set not null;

-- At most one open enrollment per class per school pupil
create unique index if not exists students_active_class_enrollment_uidx
  on public.students (school_student_id, class_id)
  where enrollment_ended_at is null;

create index if not exists students_school_student_idx
  on public.students (school_student_id);

create index if not exists students_active_enrollment_idx
  on public.students (tenant_id, class_id)
  where enrollment_ended_at is null;

-- Audit trail: extend event types for roster / archive / multi-class locate
alter table public.student_events
  add column if not exists school_student_id uuid references public.school_students (id) on delete set null;

alter table public.student_events drop constraint if exists student_events_event_type_check;

alter table public.student_events
  add constraint student_events_event_type_check
  check (
    event_type in (
      'added',
      'deleted',
      'moved',
      'enrolled',
      'unenrolled',
      'inactivated',
      'reactivated'
    )
  );

comment on column public.student_events.event_type is
  'added/deleted/moved = legacy class-row events; enrolled/unenrolled = locate/remove class; inactivated/reactivated = active/inactive lists';
