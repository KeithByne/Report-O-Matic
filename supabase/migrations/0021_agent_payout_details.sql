-- Optional payout / identity details for agents (Owner/Agent).

alter table public.agent_links
  add column if not exists payout_name text,
  add column if not exists payout_contact_email text,
  add column if not exists payout_stripe_account_id text;

