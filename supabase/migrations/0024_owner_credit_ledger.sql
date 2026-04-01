-- Report credits are pooled per account owner (user email), not per school.
-- Apply this migration before deploying the app version that reads owner_credit_ledger,
-- or balances will appear as zero until this runs.
-- All schools where that email has role 'owner' draw from the same balance.

create table if not exists public.owner_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null,
  delta_credits int not null,
  reason text not null check (reason in ('purchase', 'consume', 'manual_adjust')),
  tenant_id uuid references public.tenants (id) on delete set null,
  report_id uuid references public.reports (id) on delete set null,
  stripe_event_id text,
  created_at timestamptz not null default now(),
  unique (owner_email, report_id, reason)
);

create index if not exists owner_credit_ledger_owner_idx
  on public.owner_credit_ledger (owner_email, created_at desc);

create unique index if not exists owner_credit_ledger_stripe_event_uidx
  on public.owner_credit_ledger (stripe_event_id)
  where stripe_event_id is not null;

alter table public.owner_credit_ledger enable row level security;

-- One-time copy from legacy tenant-scoped ledger (first owner per tenant wins if multiples).
insert into public.owner_credit_ledger (owner_email, delta_credits, reason, tenant_id, report_id, stripe_event_id, created_at)
select o.owner_email, tcl.delta_credits, tcl.reason, tcl.tenant_id, tcl.report_id, tcl.stripe_event_id, tcl.created_at
from public.tenant_credit_ledger tcl
inner join lateral (
  select user_email as owner_email
  from public.memberships
  where tenant_id = tcl.tenant_id and role = 'owner'
  order by user_email asc
  limit 1
) o on true;
