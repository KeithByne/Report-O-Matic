-- Deleting a class removes its students (and their reports cascade via students).

alter table public.students drop constraint if exists students_class_id_fkey;

alter table public.students
  add constraint students_class_id_fkey
  foreign key (class_id) references public.classes (id) on delete cascade;
