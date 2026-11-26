-- M4 security tests: campaigns, confirmed offer/dates, cross-workspace products.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email) values
  ('a4444444-4444-4444-4444-444444444444', 'a4@example.com'),
  ('b4444444-4444-4444-4444-444444444444', 'b4@example.com');

create temp table ids as
select
  (select id from public.workspaces where owner_id = 'a4444444-4444-4444-4444-444444444444') as ws_a,
  (select id from public.workspaces where owner_id = 'b4444444-4444-4444-4444-444444444444') as ws_b;
grant select on ids to authenticated, anon;

insert into public.business_profiles (id, workspace_id, name, industry)
select 'a4444444-0000-0000-0000-000000000001', ws_a, 'A Cafe', 'food' from ids;
insert into public.business_profiles (id, workspace_id, name, industry)
select 'b4444444-0000-0000-0000-000000000001', ws_b, 'B Shop', 'retail' from ids;
insert into public.products (id, workspace_id, business_id, name, price)
select 'b4444444-1111-0000-0000-000000000001', ws_b, 'b4444444-0000-0000-0000-000000000001', 'B Saree', 2499 from ids;
insert into public.campaigns (id, workspace_id, business_id, name, offer_text)
select 'b4444444-2222-0000-0000-000000000001', ws_b, 'b4444444-0000-0000-0000-000000000001', 'B Sale', '10% OFF' from ids;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a4444444-4444-4444-4444-444444444444","role":"authenticated"}', true);

select lives_ok(
  $$ insert into public.campaigns (workspace_id, business_id, name, offer_text, start_date, end_date)
     select ws_a, 'a4444444-0000-0000-0000-000000000001', 'Chai Week', '20% OFF', '2026-12-01', '2026-12-07' from ids $$,
  'A can create a campaign');
select is((select count(*) from public.campaigns), 1::bigint, 'A sees only their own campaigns');

select throws_ok(
  $$ insert into public.campaigns (workspace_id, business_id, name) select ws_b, 'b4444444-0000-0000-0000-000000000001', 'Hijack' from ids $$,
  '42501', null, 'A cannot create a campaign in B''s workspace');
select throws_ok(
  $$ insert into public.campaigns (workspace_id, business_id, product_id, name)
     select ws_a, 'a4444444-0000-0000-0000-000000000001', 'b4444444-1111-0000-0000-000000000001', 'Steal' from ids $$,
  '23503', null, 'A cannot use B''s product in a campaign');
select throws_ok(
  $$ update public.campaigns set facts_confirmed_at = now() where name = 'Chai Week' $$,
  '42501', null, 'A cannot confirm the offer by editing the column');
select throws_ok(
  $$ update public.campaigns set status = 'ready' where name = 'Chai Week' $$,
  '42501', null, 'A cannot set the campaign status directly');
select throws_ok(
  $$ insert into public.campaigns (workspace_id, business_id, name, start_date, end_date)
     select ws_a, 'a4444444-0000-0000-0000-000000000001', 'Backwards', '2026-12-07', '2026-12-01' from ids $$,
  '23514', null, 'the end date cannot be before the start date');
select throws_ok(
  $$ insert into public.campaigns (workspace_id, business_id, name, style_id)
     select ws_a, 'a4444444-0000-0000-0000-000000000001', 'Bad style', 'unknown' from ids $$,
  '23514', null, 'only known styles are accepted');

select isnt(public.confirm_campaign_facts((select id from public.campaigns where name = 'Chai Week')), null,
  'A can confirm their offer and dates');
select is((select facts_confirmed_by from public.campaigns where name = 'Chai Week'),
  'a4444444-4444-4444-4444-444444444444'::uuid, 'the confirmation records who confirmed');
select throws_ok($$ select public.confirm_campaign_facts('b4444444-2222-0000-0000-000000000001') $$,
  'P0002', null, 'A cannot confirm B''s campaign');

update public.campaigns set offer_text = '25% OFF' where name = 'Chai Week';
select is((select facts_confirmed_at from public.campaigns where name = 'Chai Week'), null,
  'changing the offer clears its confirmation');
select public.confirm_campaign_facts((select id from public.campaigns where name = 'Chai Week'));
update public.campaigns set end_date = '2026-12-10' where name = 'Chai Week';
select is((select facts_confirmed_at from public.campaigns where name = 'Chai Week'), null,
  'changing the dates clears the confirmation');

update public.campaigns set name = 'Hacked' where id = 'b4444444-2222-0000-0000-000000000001';
reset role;
select is((select name from public.campaigns where id = 'b4444444-2222-0000-0000-000000000001'), 'B Sale',
  'A''s update did not touch B''s campaign');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select * from public.campaigns $$, '42501', null, 'anonymous visitors cannot read campaigns');

select * from finish();
rollback;
