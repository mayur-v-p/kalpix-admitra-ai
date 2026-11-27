-- M10 security tests: business photos stay in their workspace; one main photo; exports of an
-- ad without a product use the main business photo.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('a1010101-0000-0000-0000-000000000001', 'a10@example.com'),
  ('b1010101-0000-0000-0000-000000000001', 'b10@example.com');

create temp table ids as
select
  (select id from public.workspaces where owner_id = 'a1010101-0000-0000-0000-000000000001') as ws_a,
  (select id from public.workspaces where owner_id = 'b1010101-0000-0000-0000-000000000001') as ws_b;
grant select on ids to authenticated, anon;

insert into public.business_profiles (workspace_id, name, industry) select ws_a, 'A Cafe', 'cafe' from ids;
insert into public.business_profiles (workspace_id, name, industry) select ws_b, 'B Shop', 'clothing' from ids;
update public.credit_balances set available = 100 where workspace_id = (select ws_a from ids);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1010101-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$ insert into public.business_photos (workspace_id, business_id, path, label)
     select ws_a, (select id from public.business_profiles where name = 'A Cafe'), ws_a::text || '/business/inside.jpg', 'Inside' from ids $$,
  'A can add a photo of their business');
select is((select is_main from public.business_photos where label = 'Inside'), true,
  'the first photo becomes the main photo');
select lives_ok(
  $$ insert into public.business_photos (workspace_id, business_id, path, label)
     select ws_a, (select id from public.business_profiles where name = 'A Cafe'), ws_a::text || '/business/chai.jpg', 'Chai' from ids $$,
  'A can add a second photo');
select throws_ok(
  $$ insert into public.business_photos (workspace_id, business_id, path)
     select ws_a, (select id from public.business_profiles where name = 'A Cafe'), ws_b::text || '/business/x.jpg' from ids $$,
  '23514', null, 'a photo path must be in the own workspace folder');
select throws_ok(
  $$ insert into public.business_photos (workspace_id, business_id, path)
     select ws_b, (select id from public.business_profiles where workspace_id = (select ws_b from ids)), ws_b::text || '/business/x.jpg' from ids $$,
  '42501', null, 'A cannot add a photo to B''s business');
select throws_ok(
  $$ update public.business_photos set is_main = true where label = 'Chai' $$,
  '42501', null, 'the main photo is not set by editing the column');

select public.set_main_business_photo((select id from public.business_photos where label = 'Chai'));
select is((select label from public.business_photos where is_main), 'Chai',
  'set_main_business_photo moves the main photo');

reset role;
insert into public.campaigns (workspace_id, business_id, name, purpose)
select ws_a, (select id from public.business_profiles where name = 'A Cafe'), 'Promote', 'promote' from ids;
set local role authenticated;
select isnt(public.create_render_job((select id from public.campaigns where name = 'Promote'), array['9:16']), null,
  'an ad without a product can be exported');
select is((select params -> 'assets' ->> 'productImagePath' from public.generation_jobs
           where campaign_id = (select id from public.campaigns where name = 'Promote')),
  (select ws_a::text || '/business/chai.jpg' from ids), 'the export uses the main business photo');

select * from finish();
rollback;
