-- M6 security tests: AI scene clips (cache, credits, review, free regeneration, export gate)
-- and the AI-enhanced product image.
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

insert into auth.users (id, email) values
  ('a6666666-6666-6666-6666-666666666666', 'a6@example.com'),
  ('b6666666-6666-6666-6666-666666666666', 'b6@example.com');

create temp table ids as
select
  (select id from public.workspaces where owner_id = 'a6666666-6666-6666-6666-666666666666') as ws_a,
  (select id from public.workspaces where owner_id = 'b6666666-6666-6666-6666-666666666666') as ws_b;
grant select on ids to authenticated, anon, service_role;
create temp table clips (name text primary key, id uuid, cached boolean);
grant select, insert on clips to authenticated, service_role;

insert into public.business_profiles (id, workspace_id, name, industry)
select 'a6666666-0000-0000-0000-000000000001', ws_a, 'A Cafe', 'food' from ids;
insert into public.business_profiles (id, workspace_id, name, industry)
select 'b6666666-0000-0000-0000-000000000001', ws_b, 'B Shop', 'retail' from ids;
insert into public.products (id, workspace_id, business_id, name, price, image_path)
select 'a6666666-1111-0000-0000-000000000001', ws_a, 'a6666666-0000-0000-0000-000000000001', 'Chai', 30, ws_a || '/chai.png' from ids;
insert into public.campaigns (id, workspace_id, business_id, product_id, name, offer_text)
select 'a6666666-2222-0000-0000-000000000001', ws_a, 'a6666666-0000-0000-0000-000000000001',
       'a6666666-1111-0000-0000-000000000001', 'Chai Week', '20% OFF' from ids;
insert into public.campaigns (id, workspace_id, business_id, name)
select 'b6666666-2222-0000-0000-000000000001', ws_b, 'b6666666-0000-0000-0000-000000000001', 'B Sale' from ids;

-- ================================================================ visitors
set local role anon;
select is((select count(*) from public.ai_scene_types), 5::bigint, 'visitors can browse the scene types');
select throws_ok($$ select count(*) from public.ai_video_clips $$, '42501', null, 'visitors cannot read clips');

-- ================================================================ A (owner)
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a6666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
select throws_ok($$ update public.ai_scene_types set credit_cost = 0 $$, '42501', null,
  'owners cannot change scene prices');
select throws_ok(
  $$ select * from public.reserve_ai_clip('a6666666-6666-6666-6666-666666666666', 'a6666666-1111-0000-0000-000000000001', 'steam_closeup', 'composite', 'mock', 'm') $$,
  '42501', null, 'owners cannot reserve clips directly (only via start-ai-video)');
select throws_ok($$ update public.products set use_enhanced = true $$, '42501', null,
  'owners cannot flip the enhanced image flag directly');
select throws_ok(
  $$ select public.choose_product_image('a6666666-1111-0000-0000-000000000001', true) $$,
  'P0001', 'enhanced_not_ready', 'the enhanced image can be chosen only once it exists');
select throws_ok($$ select count(*) from public.webhook_events $$, '42501', null,
  'owners cannot read webhook events');

-- ================================================================ start-ai-video (service role)
reset role;
set local role service_role;
select throws_ok(
  $$ select * from public.reserve_ai_clip('b6666666-6666-6666-6666-666666666666', 'a6666666-1111-0000-0000-000000000001', 'steam_closeup', 'composite', 'mock', 'm') $$,
  'P0002', null, 'B cannot start a clip from A''s product');
select throws_ok(
  $$ select * from public.reserve_ai_clip('a6666666-6666-6666-6666-666666666666', 'a6666666-1111-0000-0000-000000000001', 'spa_calm', 'composite', 'mock', 'm') $$,
  '22023', 'invalid_scene', 'scenes are limited to the business''s industry');

insert into clips select 'steam', clip_id, cached from public.reserve_ai_clip(
  'a6666666-6666-6666-6666-666666666666', 'a6666666-1111-0000-0000-000000000001', 'steam_closeup', 'composite', 'mock', 'm');
select is((select cached from clips where name = 'steam'), false, 'a new clip is created');
select results_eq($$ select available, reserved from public.credit_balances where workspace_id = (select ws_a from ids) $$,
  $$ values (8, 2) $$, 'its credits are reserved');

insert into clips select 'steam-again', clip_id, cached from public.reserve_ai_clip(
  'a6666666-6666-6666-6666-666666666666', 'a6666666-1111-0000-0000-000000000001', 'steam_closeup', 'composite', 'mock', 'm');
select ok((select cached and id = (select id from clips where name = 'steam') from clips where name = 'steam-again'),
  'the same product + scene is served from the cache');
select results_eq($$ select available, reserved from public.credit_balances where workspace_id = (select ws_a from ids) $$,
  $$ values (8, 2) $$, 'cached clips cost nothing');

select ok(public.mark_ai_clip_submitted((select id from clips where name = 'steam'), 'mock_1'), 'clip submitted to the provider');
select ok(public.ai_clip_ready((select id from clips where name = 'steam'), null, null, 5), 'provider result arrives');
select ok(public.ai_clip_ready((select id from clips where name = 'steam'), null, null, 5), 'a repeated result is harmless');
select results_eq($$ select available, reserved from public.credit_balances where workspace_id = (select ws_a from ids) $$,
  $$ values (8, 0) $$, 'credits are spent once, when the clip is ready for review');

-- ================================================================ A reviews
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a6666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
select is((select status from public.ai_video_clips where id = (select id from clips where name = 'steam')),
  'REVIEW_READY', 'A sees the clip waiting for review');
select throws_ok($$ update public.ai_video_clips set status = 'COMPLETED' $$, '42501', null,
  'A cannot approve a clip by editing it');
select lives_ok(
  $$ update public.campaigns set scene_clip_id = (select id from clips where name = 'steam') where id = 'a6666666-2222-0000-0000-000000000001' $$,
  'A can put the clip in their campaign');
select public.confirm_campaign_facts('a6666666-2222-0000-0000-000000000001');
select public.confirm_product_price('a6666666-1111-0000-0000-000000000001');
select throws_ok(
  $$ select public.create_render_job('a6666666-2222-0000-0000-000000000001', array['9:16']) $$,
  'P0001', 'clip_not_approved', 'an unapproved AI scene cannot be exported');
select is(public.review_ai_clip((select id from clips where name = 'steam'), false), 'CANCELLED', 'A rejects the clip');
select is((select scene_clip_id from public.campaigns where id = 'a6666666-2222-0000-0000-000000000001'), null,
  'a rejected clip leaves the campaign');

-- Free regeneration
reset role;
set local role service_role;
insert into clips select 'regen', clip_id, cached from public.reserve_ai_clip(
  'a6666666-6666-6666-6666-666666666666', 'a6666666-1111-0000-0000-000000000001', 'steam_closeup', 'composite', 'mock', 'm');
select results_eq($$ select cost, free_regeneration from public.ai_video_clips where id = (select id from clips where name = 'regen') $$,
  $$ values (0, true) $$, 'the first regeneration after a rejection is free');
select public.ai_clip_ready((select id from clips where name = 'regen'), null, null, 5);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a6666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
select is(public.review_ai_clip((select id from clips where name = 'regen'), true), 'COMPLETED', 'A approves the new clip');
update public.campaigns set scene_clip_id = (select id from clips where name = 'regen') where id = 'a6666666-2222-0000-0000-000000000001';
select lives_ok(
  $$ select public.create_render_job('a6666666-2222-0000-0000-000000000001', array['9:16']) $$,
  'an approved AI scene can be exported');
select is(
  (select params -> 'scene' ->> 'style' from public.generation_jobs where campaign_id = 'a6666666-2222-0000-0000-000000000001'),
  'steam', 'the export snapshot carries the approved scene');

-- ================================================================ B (other business)
select set_config('request.jwt.claims', '{"sub":"b6666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
select is((select count(*) from public.ai_video_clips), 0::bigint, 'B cannot see A''s clips');
select throws_ok(
  $$ update public.campaigns set scene_clip_id = (select id from clips where name = 'regen') where id = 'b6666666-2222-0000-0000-000000000001' $$,
  '23503', null, 'B cannot use A''s clip in their campaign');
select throws_ok(
  $$ select public.review_ai_clip((select id from clips where name = 'regen'), false) $$,
  'P0002', null, 'B cannot review A''s clip');

-- ================================================================ failures and limits
reset role;
set local role service_role;
insert into clips select 'festive', clip_id, cached from public.reserve_ai_clip(
  'a6666666-6666-6666-6666-666666666666', 'a6666666-1111-0000-0000-000000000001', 'festive_lights', 'composite', 'mock', 'm');
select public.fail_ai_clip((select id from clips where name = 'festive'), 'provider error');
select results_eq($$ select available, reserved from public.credit_balances where workspace_id = (select ws_a from ids) $$,
  $$ values (7, 1) $$, 'a failed clip returns its credits (the queued export still holds 1)');

reset role;
update public.credit_balances set available = 0 where workspace_id = (select ws_a from ids);
set local role service_role;
select throws_ok(
  $$ select * from public.reserve_ai_clip('a6666666-6666-6666-6666-666666666666', 'a6666666-1111-0000-0000-000000000001', 'sunrise_glow', 'composite', 'mock', 'm') $$,
  'P0001', 'insufficient_credits', 'a new clip needs enough credits');

select * from finish();
rollback;
