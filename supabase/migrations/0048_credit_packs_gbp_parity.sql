-- GBP list prices: same numeric amounts as legacy EUR packs (€25 → £25.00, etc.).
-- tester £5, economy £25, school £50, large_school £100, universal_school £500

update public.credit_packs
set
  currency = 'gbp',
  price_cents = case id
    when 'tester' then 500
    when 'economy' then 2500
    when 'school' then 5000
    when 'large_school' then 10000
    when 'universal_school' then 50000
    else price_cents
  end
where id in ('tester', 'economy', 'school', 'large_school', 'universal_school');
