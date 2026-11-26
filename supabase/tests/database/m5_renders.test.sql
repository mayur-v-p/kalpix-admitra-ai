-- M5 security tests: credits, render jobs (queue + lifecycle), QR links, renders bucket.
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);
-- Jobs left in the local database by manual runs would be claimed first; set them aside
-- (this transaction is rolled back at the end).
update public.generation_jobs set status = 'FAILED' where status in ('QUEUED', 'PROCESSING');

insert into auth.users (id, email) values
  ('a5555555-5555-5555-5555-555555555555', 'a5@example.com'),
  ('b5555555-5555-5555-5555-555555555555', 'b5@example.com');

create temp table ids as
select
  (select id from public.workspaces where owner_id = 'a5555555-5555-5555-5555-555555555555') as ws_a,
  (select id from public.workspaces where owner_id = 'b5555555-5555-5555-5555-555555555555') as ws_b;
grant select on ids to authenticated, anon, service_role;
create temp table jobs (name text primary key, id uuid);
grant select, insert on jobs to authenticated, service_role;

insert into public.business_profiles (id, workspace_id, name, industry)
select 'a5555555-0000-0000-0000-000000000001', ws_a, 'A Cafe', 'food' from ids;
insert into public.business_profiles (id, workspace_id, name, industry)
select 'b5555555-0000-0000-0000-000000000001', ws_b, 'B Shop', 'retail' from ids;
insert into public.products (id, workspace_id, business_id, name, price)
select 'a5555555-1111-0000-0000-000000000001', ws_a, 'a5555555-0000-0000-0000-000000000001', 'Chai', 30 from ids;
insert into public.campaigns (id, workspace_id, business_id, product_id, name, offer_text)
select 'a5555555-2222-0000-0000-000000000001', ws_a, 'a5555555-0000-0000-0000-000000000001',
       'a5555555-1111-0000-0000-000000000001', 'Chai Week', '20% OFF' from ids;
insert into public.campaigns (id, workspace_id, business_id, name)
select 'b5555555-2222-0000-0000-000000000001', ws_b, 'b5555555-0000-0000-0000-000000000001', 'B Sale' from ids;
-- A file in each business's renders folder
insert into storage.objects (bucket_id, name)
select 'renders', ws_a || '/job/ad.mp4' from ids union all
select 'renders', ws_b || '/job/ad.mp4' from ids;

-- ================================================================ as A (owner)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a5555555-5555-5555-5555-555555555555","role":"authenticated"}', true);

select results_eq($$ select available, reserved from public.credit_balances $$,
  $$ values (10, 0) $$, 'A sees only their own balance: 10 free credits');
select is((select count(*) from public.credit_ledger where kind = 'grant'), 1::bigint,
  'the free credits are in A''s ledger');
select is((select count(*) from public.qr_links), 1::bigint, 'each campaign gets a QR link; A sees only theirs');
select matches((select code from public.qr_links), '^[0-9a-f]{12}$', 'QR code is a random 12-character code');

select throws_ok(
  $$ select public.create_render_job('a5555555-2222-0000-0000-000000000001', array['9:16']) $$,
  'P0001', 'facts_not_confirmed', 'export is refused while the offer and price are unconfirmed');

select public.confirm_campaign_facts('a5555555-2222-0000-0000-000000000001');
select public.confirm_product_price('a5555555-1111-0000-0000-000000000001');

select throws_ok(
  $$ select public.create_render_job('a5555555-2222-0000-0000-000000000001', array['9:16', '3:2']) $$,
  '22023', 'invalid_formats', 'unknown sizes are refused');
select throws_ok(
  $$ select public.create_render_job('a5555555-2222-0000-0000-000000000001', array[]::text[]) $$,
  '22023', 'invalid_formats', 'an export needs at least one size');

select lives_ok(
  $$ insert into jobs select 'first', public.create_render_job('a5555555-2222-0000-0000-000000000001', array['9:16', '1:1', '1:1']) $$,
  'A can export a campaign with confirmed facts');
select results_eq(
  $$ select status, formats, cost from public.generation_jobs where id = (select id from jobs where name = 'first') $$,
  $$ values ('QUEUED'::text, array['9:16', '1:1']::text[], 2) $$,
  'the job is queued once per size and costs 1 credit per size');
select results_eq($$ select available, reserved from public.credit_balances $$,
  $$ values (8, 2) $$, 'credits are reserved, not yet spent');
select is(
  (select params -> 'campaign' ->> 'offer_text' from public.generation_jobs where id = (select id from jobs where name = 'first')),
  '20% OFF', 'the job carries a snapshot of the confirmed offer');
select throws_ok(
  $$ select public.create_render_job('a5555555-2222-0000-0000-000000000001', array['4:5']) $$,
  'P0001', 'export_in_progress', 'one export at a time per campaign');

select throws_ok(
  $$ insert into public.generation_jobs (workspace_id, type, template_id, formats, params)
     select ws_a, 'render', 'outline_highlight', array['9:16'], '{}' from ids $$,
  '42501', null, 'A cannot insert jobs directly (skipping credits)');
select throws_ok(
  $$ update public.generation_jobs set status = 'COMPLETED' $$,
  '42501', null, 'A cannot change a job''s status');
select throws_ok(
  $$ update public.credit_balances set available = 9999 $$,
  '42501', null, 'A cannot change their balance');
select throws_ok(
  $$ insert into public.credit_ledger (workspace_id, kind, amount) select ws_a, 'grant', 100 from ids $$,
  '42501', null, 'A cannot write credit history');
select throws_ok(
  $$ insert into public.creative_assets (workspace_id, job_id, format, kind, path, width, height)
     select ws_a, (select id from jobs limit 1), '9:16', 'mp4', ws_a || '/x.mp4', 1, 1 from ids $$,
  '42501', null, 'A cannot add export files');
select throws_ok(
  $$ select * from public.claim_render_job('evil', 60) $$,
  '42501', null, 'A cannot call the worker functions');
select throws_ok(
  $$ select public.fail_render_job((select id from jobs limit 1), 'evil', 'x', false) $$,
  '42501', null, 'A cannot fail a job to trigger a refund');

select is((select count(*) from storage.objects where bucket_id = 'renders'), 1::bigint,
  'A sees only their own exported files');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) select 'renders', ws_a || '/fake.mp4' from ids $$,
  '42501', null, 'A cannot upload into the renders bucket');

-- ================================================================ as B (other business)
select set_config('request.jwt.claims', '{"sub":"b5555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select is((select count(*) from public.generation_jobs), 0::bigint, 'B cannot see A''s jobs');
select results_eq($$ select available, reserved from public.credit_balances $$,
  $$ values (10, 0) $$, 'B sees only their own balance');
select throws_ok(
  $$ select public.create_render_job('a5555555-2222-0000-0000-000000000001', array['9:16']) $$,
  'P0002', null, 'B cannot export A''s campaign (or spend A''s credits)');

-- ================================================================ as the worker
reset role;
set local role service_role;
select results_eq(
  $$ select status, attempts from public.claim_render_job('w1', 60) $$,
  $$ values ('PROCESSING'::text, 1) $$, 'the worker claims the queued job');
select is((select count(*) from public.claim_render_job('w2', 60)), 0::bigint,
  'a claimed job is not handed to a second worker');
select is(public.heartbeat_render_job((select id from jobs where name = 'first'), 'w2', 0.5, 60), false,
  'a worker that does not own the job cannot report on it');
select is(public.fail_render_job((select id from jobs where name = 'first'), 'w1', 'Chromium crashed', true),
  'QUEUED', 'a failed attempt goes back to the queue');
select is((select attempts from public.claim_render_job('w1', 60)), 2, 'and is claimed again');
select is(public.fail_render_job((select id from jobs where name = 'first'), 'w1', 'Chromium crashed', false),
  'FAILED', 'a final failure marks the job FAILED');
select results_eq($$ select available, reserved from public.credit_balances where workspace_id = (select ws_a from ids) $$,
  $$ values (10, 0) $$, 'and returns the reserved credits automatically');

-- A second export that succeeds
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a5555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
insert into jobs select 'second', public.create_render_job('a5555555-2222-0000-0000-000000000001', array['4:5', '16:9', '9:16']);
reset role;
set local role service_role;
select public.claim_render_job('w1', 60);
select is(public.complete_render_job((select id from jobs where name = 'second'), 'w1', '0.3.0'), true,
  'the worker completes the job');
select is(public.complete_render_job((select id from jobs where name = 'second'), 'w1', '0.3.0'), true,
  'completing twice is harmless (idempotent)');
select results_eq($$ select available, reserved from public.credit_balances where workspace_id = (select ws_a from ids) $$,
  $$ values (7, 0) $$, 'completed exports spend their credits exactly once');
select results_eq(
  $$ select
       sum(amount) filter (where kind in ('grant', 'release', 'refund', 'adjust')) - sum(amount) filter (where kind = 'reserve'),
       sum(amount) filter (where kind = 'reserve') - coalesce(sum(amount) filter (where kind in ('consume', 'release')), 0)
     from public.credit_ledger where workspace_id = (select ws_a from ids) $$,
  $$ select available::bigint, reserved::bigint from public.credit_balances where workspace_id = (select ws_a from ids) $$,
  'the ledger adds up to the balance');

-- Not enough credits
reset role;
update public.credit_balances set available = 1 where workspace_id = (select ws_a from ids);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a5555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select throws_ok(
  $$ select public.create_render_job('a5555555-2222-0000-0000-000000000001', array['9:16', '1:1']) $$,
  'P0001', 'insufficient_credits', 'an export needs enough credits');

-- Visitors
reset role;
set local role anon;
select throws_ok($$ select count(*) from public.generation_jobs $$, '42501', null,
  'visitors cannot read jobs');

select * from finish();
rollback;
