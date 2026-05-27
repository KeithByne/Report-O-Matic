-- GBP list prices: EUR packs (0019) × 0.86 × 1.10 (Paddle MoR margin), rounded to pence.
-- tester 473, economy 2365, school 4730, large_school 9460, universal_school 47300

alter table public.credit_packs
  add column if not exists paddle_price_id text;

comment on column public.credit_packs.paddle_price_id is
  'Optional Paddle catalog price id (pri_…). When set, checkout uses this price; otherwise a one-off line item is created from price_cents.';

update public.credit_packs
set
  currency = 'gbp',
  price_cents = case id
    when 'tester' then 473
    when 'economy' then 2365
    when 'school' then 4730
    when 'large_school' then 9460
    when 'universal_school' then 47300
    else price_cents
  end
where id in ('tester', 'economy', 'school', 'large_school', 'universal_school');
