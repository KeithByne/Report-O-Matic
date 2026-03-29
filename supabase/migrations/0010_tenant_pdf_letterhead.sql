-- Owner-configurable PDF letterhead / header (printed reports).

alter table public.tenants
  add column if not exists pdf_letterhead_name text,
  add column if not exists pdf_letterhead_tagline text,
  add column if not exists pdf_letterhead_address text,
  add column if not exists pdf_letterhead_contact text;

comment on column public.tenants.pdf_letterhead_name is 'Official name on PDF; null = use tenants.name';
comment on column public.tenants.pdf_letterhead_tagline is 'Optional line under school name';
comment on column public.tenants.pdf_letterhead_address is 'Postal / location block';
comment on column public.tenants.pdf_letterhead_contact is 'Phone, email, website (one or more lines)';
