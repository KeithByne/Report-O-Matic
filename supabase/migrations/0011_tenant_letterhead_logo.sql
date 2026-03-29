-- Optional company logo for PDF letterhead (private Storage path).
-- Removes per-tenant document title (no longer used on PDFs).

alter table public.tenants
  drop column if exists pdf_document_title;

alter table public.tenants
  add column if not exists pdf_letterhead_logo_path text;

comment on column public.tenants.pdf_letterhead_logo_path is
  'Object key in storage bucket tenant-letterhead-logos; null = no logo';

insert into storage.buckets (id, name, public)
values ('tenant-letterhead-logos', 'tenant-letterhead-logos', false)
on conflict (id) do nothing;
