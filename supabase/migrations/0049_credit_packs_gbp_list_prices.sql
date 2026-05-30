-- GBP list prices (pence in price_cents): Paddle-adjusted figures; report credits unchanged.
-- tester £5, economy £25, school £500, large_school £1,000, universal_school £5,000

update public.credit_packs
set
  currency = 'gbp',
  price_cents = case id
    when 'tester' then 500
    when 'economy' then 2500
    when 'school' then 50000
    when 'large_school' then 100000
    when 'universal_school' then 500000
    else price_cents
  end
where id in ('tester', 'economy', 'school', 'large_school', 'universal_school');
