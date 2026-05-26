-- Evolve support threads into numbered issue cases (multiple per user).

create sequence if not exists public.support_case_number_seq start 1;

alter table public.support_threads rename to support_cases;

alter table public.support_cases drop constraint if exists support_threads_user_email_unique;

alter table public.support_cases
  add column if not exists case_number int,
  add column if not exists subject text,
  add column if not exists category text,
  add column if not exists description text,
  add column if not exists resolved_at timestamptz;

update public.support_cases
set case_number = nextval('public.support_case_number_seq')
where case_number is null;

alter table public.support_cases
  alter column case_number set not null;

alter table public.support_cases
  add constraint support_cases_case_number_unique unique (case_number);

alter table public.support_cases
  alter column case_number set default nextval('public.support_case_number_seq');

alter table public.support_messages drop constraint if exists support_messages_sender_role_check;

alter table public.support_messages
  add constraint support_messages_sender_role_check
  check (sender_role in ('user', 'owner', 'system'));

update public.support_cases set status = 'resolved' where status = 'closed';

alter table public.support_cases drop constraint if exists support_threads_status_check;

alter table public.support_cases
  add constraint support_cases_status_check check (status in ('open', 'resolved'));

alter table public.support_messages rename column thread_id to case_id;

alter table public.support_messages drop constraint if exists support_messages_thread_id_fkey;

alter table public.support_messages
  add constraint support_messages_case_id_fkey
  foreign key (case_id) references public.support_cases (id) on delete cascade;

drop index if exists public.support_messages_thread_created_idx;

create index if not exists support_messages_case_created_idx
  on public.support_messages (case_id, created_at asc);

create index if not exists support_cases_user_email_idx on public.support_cases (lower(user_email), updated_at desc);

create index if not exists support_cases_status_idx on public.support_cases (status, updated_at desc);
