-- Structured letterhead contact: phone, mobile, email + inline vs stacked layout on PDF.

alter table public.tenants
  add column if not exists pdf_letterhead_contact_layout text not null default 'inline',
  add column if not exists pdf_letterhead_phone text,
  add column if not exists pdf_letterhead_mobile text,
  add column if not exists pdf_letterhead_email text;

alter table public.tenants drop constraint if exists tenants_pdf_letterhead_contact_layout_check;

alter table public.tenants
  add constraint tenants_pdf_letterhead_contact_layout_check
  check (pdf_letterhead_contact_layout in ('inline', 'stacked'));

comment on column public.tenants.pdf_letterhead_contact_layout is
  'PDF contact block: inline (one line) or stacked (one line per field with symbols).';
comment on column public.tenants.pdf_letterhead_phone is 'Landline telephone on PDF letterhead.';
comment on column public.tenants.pdf_letterhead_mobile is 'Mobile number on PDF letterhead.';
comment on column public.tenants.pdf_letterhead_email is 'Email address on PDF letterhead.';
