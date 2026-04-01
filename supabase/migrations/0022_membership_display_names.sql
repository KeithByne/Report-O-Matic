-- Add teacher (and member) display name fields for UI.
-- Kept nullable for backward compatibility; new invites should populate these.

alter table public.memberships
  add column if not exists first_name text,
  add column if not exists last_name text;

