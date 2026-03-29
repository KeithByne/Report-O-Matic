-- Dual-language AI preview: PDF uses `body` (output_language); teacher preview uses `body_teacher_preview`.

alter table public.reports
  add column if not exists body_teacher_preview text not null default '';

alter table public.reports
  add column if not exists teacher_preview_language text not null default 'en';
