-- M3 security tests: products, confirmed facts, product-images bucket, rate limits.
-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- ---------------------------------------------------------------- setup (as postgres)
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a3@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b3@example.com');

create temp table ids as
select
  (select id from public.workspaces where owner_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') as ws_a,
  (select id from public.workspaces where owner_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') as ws_b;
grant select on ids to authenticated, anon;

insert into public.business_profiles (id, workspace_id, name, industry, phone)
select 'aaaaaaaa-0000-0000-0000-000000000001', ws_a, 'A Cafe', 'food', '+91 90000 00001' from ids;
insert into public.business_profiles (id, workspace_id, name, industry)
select 'bbbbbbbb-0000-0000-0000-000000000001', ws_b, 'B Store', 'retail' from ids;
insert into public.products (id, workspace_id, business_id, name, price, image_path)
select 'bbbbbbbb-1111-0000-0000-000000000001', ws_b, 'bbbbbbbb-0000-0000-0000-000000000001',
       'B Kurta', 999, ws_b || '/originals/kurta.jpg' from ids;
insert into storage.objects (bucket_id, name)
select 'product-images', ws_b || '/originals/kurta.jpg' from ids;

-- ---------------------------------------------------------------- as user A
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

select lives_ok(
  $$ insert into public.products (workspace_id, business_id, name, price, image_path)
     select ws_a, 'aaaaaaaa-0000-0000-0000-000000000001', 'Masala Chai', 30, ws_a || '/originals/chai.jpg' from ids $$,
  'A can add a product with a photo to their own workspace');
select is((select cutout_status from public.products where name = 'Masala Chai'), 'pending',
  'a new product with a photo waits for its cutout');
select is((select count(*) from public.products), 1::bigint, 'A sees only their own products');

select throws_ok(
  $$ insert into public.products (workspace_id, business_id, name) select ws_b, 'bbbbbbbb-0000-0000-0000-000000000001', 'Hijack' from ids $$,
  '42501', null, 'A cannot add a product to B''s workspace');
select throws_ok(
  $$ insert into public.products (workspace_id, business_id, name, image_path)
     select ws_a, 'aaaaaaaa-0000-0000-0000-000000000001', 'Steal', ws_b || '/originals/kurta.jpg' from ids $$,
  '23514', null, 'A cannot point a product at a file in B''s folder');
select throws_ok(
  $$ update public.products set cutout_status = 'ready' where name = 'Masala Chai' $$,
  '42501', null, 'A cannot mark a cutout as ready');
select throws_ok(
  $$ update public.products set cutout_path = 'x' where name = 'Masala Chai' $$,
  '42501', null, 'A cannot set the cutout path');
select throws_ok(
  $$ update public.products set price_confirmed_at = now() where name = 'Masala Chai' $$,
  '42501', null, 'A cannot confirm a price by editing the column');

update public.products set name = 'Hacked' where id = 'bbbbbbbb-1111-0000-0000-000000000001';
delete from public.products where id = 'bbbbbbbb-1111-0000-0000-000000000001';

-- confirming facts through the functions
select isnt(public.confirm_product_price((select id from public.products where name = 'Masala Chai')), null,
  'A can confirm the price of their own product');
select is((select price_confirmed_by from public.products where name = 'Masala Chai'),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'the confirmation records who confirmed');
select throws_ok(
  $$ select public.confirm_product_price('bbbbbbbb-1111-0000-0000-000000000001') $$,
  'P0002', null, 'A cannot confirm the price of B''s product');
select isnt(public.confirm_business_phone('aaaaaaaa-0000-0000-0000-000000000001'), null,
  'A can confirm their own phone number');
select throws_ok(
  $$ select public.confirm_business_phone('bbbbbbbb-0000-0000-0000-000000000001') $$,
  'P0002', null, 'A cannot confirm B''s phone number');

update public.products set price = 35 where name = 'Masala Chai';
select is((select price_confirmed_at from public.products where name = 'Masala Chai'), null,
  'changing the price clears its confirmation');
update public.products set image_path = (select ws_a from ids) || '/originals/chai-2.jpg' where name = 'Masala Chai';
select is((select cutout_status from public.products where name = 'Masala Chai'), 'pending',
  'a new photo needs a new cutout');

insert into public.products (workspace_id, business_id, name)
select ws_a, 'aaaaaaaa-0000-0000-0000-000000000001', 'No price' from ids;
select throws_ok(
  $$ select public.confirm_product_price((select id from public.products where name = 'No price')) $$,
  '22023', null, 'a missing price cannot be confirmed');

select throws_ok($$ select public.consume_rate_limit('x', 1, 60) $$, '42501', null,
  'users cannot call the rate-limit function');
select throws_ok($$ select * from public.rate_limits $$, '42501', null,
  'users cannot read rate-limit counters');

-- storage
select is((select count(*) from storage.objects where bucket_id = 'product-images'), 0::bigint,
  'A cannot list B''s product photos');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) select 'product-images', ws_b || '/originals/evil.jpg' from ids $$,
  '42501', null, 'A cannot upload into B''s product folder');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) select 'product-images', ws_a || '/originals/chai.jpg' from ids $$,
  'A can upload into their own product folder');

-- ---------------------------------------------------------------- checks as postgres
reset role;
select is((select name from public.products where id = 'bbbbbbbb-1111-0000-0000-000000000001'),
  'B Kurta', 'A''s update and delete did not touch B''s product');
select is((select count(*) from public.audit_events
           where action = 'product.price_confirmed' and workspace_id = (select ws_a from ids)), 1::bigint,
  'price confirmations are written to the audit log');

-- ---------------------------------------------------------------- anonymous
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select public.confirm_product_price(gen_random_uuid()) $$, '42501', null,
  'anonymous visitors cannot call confirm functions');

select * from finish();
rollback;
