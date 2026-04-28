-- Lets the service-role server client nudge PostgREST to reload its schema cache after DDL
-- (e.g. new columns) without opening the SQL editor. Safe to call repeatedly.
create or replace function public.rom_request_postgrest_schema_reload()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_notify('pgrst', 'reload schema');
end;
$$;

revoke all on function public.rom_request_postgrest_schema_reload() from public;
grant execute on function public.rom_request_postgrest_schema_reload() to service_role;

notify pgrst, 'reload schema';
