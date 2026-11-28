-- M11 security tests: AI pictures stay in their workspace, only the Edge Function adds them,
-- owners may only tick/untick or delete them; ads use the whole photo (no cut-out); exports use
-- the design's ticked picture and mark pictures made from words.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('a1111111-0000-0000-0000-000000000001', 'a11@example.com'),
  ('b1111111-0000-0000-0000-000000000001', 'b11@example.com');

create temp table ids as
select
  (select id from public.workspaces where owner_id = 'a1111111-0000-0000-0000-000000000001') as ws_a,
  (select id from public.workspaces where owner_id = 'b1111111-0000-0000-0000-000000000001') as ws_b;
grant select on ids to authenticated, anon;

insert into public.business_profiles (workspace_id, name, industry) select ws_a, 'M11 Sweets', 'sweets' from ids;
insert into public.business_profiles (workspace_id, name, industry) select ws_b, 'M11 B Shop', 'clothing' from ids;
update public.credit_balances set available = 100 where workspace_id = (select ws_a from ids);

-- A product with a photo and a finished cut-out, and one without a photo.
insert into public.products (workspace_id, business_id, name, image_path)
select ws_a, (select id from public.business_profiles where name = 'M11 Sweets'), 'M11 Chai', ws_a::text || '/chai.jpg' from ids;
update public.products set cutout_status = 'ready', cutout_path = (select ws_a::text || '/cutout.png' from ids)
  where name = 'M11 Chai';
insert into public.products (workspace_id, business_id, name)
select ws_a, (select id from public.business_profiles where name = 'M11 Sweets'), 'M11 Gulab Jamun' from ids;

-- What make-product-pictures (service role) writes.
insert into public.product_pictures (workspace_id, product_id, path, kind, label)
select ws_a, (select id from public.products where name = 'M11 Chai'), ws_a::text || '/pictures/window.jpg', 'scene', 'M11 window' from ids;
insert into public.product_pictures (workspace_id, product_id, path, kind, label)
select ws_a, (select id from public.products where name = 'M11 Gulab Jamun'), ws_a::text || '/pictures/jamun.jpg', 'generated', 'M11 bowl' from ids;

select is(private.product_ad_image((select p from public.products p where name = 'M11 Chai')),
  (select ws_a::text || '/chai.jpg' from ids), 'ads use the whole photo, not the cut-out');

select throws_ok(
  $$ insert into public.product_pictures (workspace_id, product_id, path, kind)
     select ws_b, (select id from public.products where name = 'M11 Chai'), ws_b::text || '/pictures/x.jpg', 'scene' from ids $$,
  '23503', null, 'a picture must belong to a product of the same workspace');
select throws_ok(
  $$ insert into public.product_pictures (workspace_id, product_id, path, kind)
     select ws_a, (select id from public.products where name = 'M11 Chai'), ws_a::text || '/other/x.jpg', 'scene' from ids $$,
  '23514', null, 'a picture must be in the workspace pictures folder');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1111111-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is((select count(*)::int from public.product_pictures), 2, 'A sees their own pictures');
select throws_ok(
  $$ insert into public.product_pictures (workspace_id, product_id, path, kind)
     select ws_a, (select id from public.products where name = 'M11 Chai'), ws_a::text || '/pictures/y.jpg', 'scene' from ids $$,
  '42501', null, 'only the Edge Function adds pictures');
select lives_ok(
  $$ update public.product_pictures set use_in_ads = false where label = 'M11 window' $$,
  'A can untick a picture');
select throws_ok(
  $$ update public.product_pictures set path = (select ws_a::text || '/pictures/z.jpg' from ids) where label = 'M11 window' $$,
  '42501', null, 'A cannot change where a picture points');
select throws_ok(
  $$ update public.product_pictures set kind = 'scene' where label = 'M11 bowl' $$,
  '42501', null, 'A cannot hide that a picture was made from words');

-- Export with a design naming the (now unticked) scene: falls back to the photo.
reset role;
insert into public.campaigns (workspace_id, business_id, product_id, name, purpose, style_id, design)
select ws_a, (select id from public.business_profiles where name = 'M11 Sweets'), (select id from public.products where name = 'M11 Chai'),
  'M11 chai ad', 'promote', 'composer',
  jsonb_build_object('v', 1, 'picture', (select id from public.product_pictures where label = 'M11 window')) from ids;
insert into public.campaigns (workspace_id, business_id, product_id, name, purpose, style_id, design)
select ws_a, (select id from public.business_profiles where name = 'M11 Sweets'), (select id from public.products where name = 'M11 Gulab Jamun'),
  'M11 jamun ad', 'promote', 'composer', jsonb_build_object('v', 1) from ids;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1111111-0000-0000-0000-000000000001","role":"authenticated"}', true);

select isnt(public.create_render_job((select id from public.campaigns where name = 'M11 chai ad'), array['9:16']), null,
  'the chai ad can be exported');
select is((select params -> 'assets' ->> 'productImagePath' from public.generation_jobs
           where campaign_id = (select id from public.campaigns where name = 'M11 chai ad')),
  (select ws_a::text || '/chai.jpg' from ids), 'an unticked picture is never used: the photo is');

reset role;
update public.product_pictures set use_in_ads = true where label = 'M11 window';
delete from public.generation_jobs where campaign_id = (select id from public.campaigns where name = 'M11 chai ad');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1111111-0000-0000-0000-000000000001","role":"authenticated"}', true);
select public.create_render_job((select id from public.campaigns where name = 'M11 chai ad'), array['9:16']);
select is((select params -> 'assets' ->> 'productImagePath' from public.generation_jobs
           where campaign_id = (select id from public.campaigns where name = 'M11 chai ad')),
  (select ws_a::text || '/pictures/window.jpg' from ids), 'a ticked picture named by the design is used');

select public.create_render_job((select id from public.campaigns where name = 'M11 jamun ad'), array['9:16']);
select is((select params -> 'assets' ->> 'productImagePath' from public.generation_jobs
           where campaign_id = (select id from public.campaigns where name = 'M11 jamun ad')),
  (select ws_a::text || '/pictures/jamun.jpg' from ids), 'a product without a photo uses its AI picture');
select is((select params -> 'assets' ->> 'imageNote' from public.generation_jobs
           where campaign_id = (select id from public.campaigns where name = 'M11 jamun ad')),
  'Image for representation only', 'a picture made from words is marked on the ad');

select set_config('request.jwt.claims', '{"sub":"b1111111-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select count(*)::int from public.product_pictures), 0, 'B cannot see A''s pictures');

select * from finish();
rollback;
