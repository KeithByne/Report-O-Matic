-- Safe if you already ran an older 0005 without assigned_teacher_email (idempotent).

alter table public.classes
  add column if not exists assigned_teacher_email text;

create index if not exists classes_assigned_teacher_lower_idx
  on public.classes (tenant_id, lower(assigned_teacher_email));
