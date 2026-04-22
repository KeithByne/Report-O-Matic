-- After DDL, PostgREST may serve a stale schema cache. This nudges a reload (no-op if listener absent).
NOTIFY pgrst, 'reload schema';
