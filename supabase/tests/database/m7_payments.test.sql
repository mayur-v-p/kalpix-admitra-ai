-- M7 security tests: plans and prices, subscriptions, packs, the Razorpay webhook function
-- (duplicates, amount checks, out-of-order events, refunds) and the watermark on exports.
begin;
create extension if not exists pgtap with schema extensions;
select plan(43);

insert into auth.users (id, email) values
  ('a7777777-7777-7777-7777-777777777777', 'a7@example.com'),
  ('b7777777-7777-7777-7777-777777777777', 'b7@example.com'),
  ('c7777777-7777-7777-7777-777777777777', 'c7@example.com');

create temp table ids as
select
  (select id from public.workspaces where owner_id = 'a7777777-7777-7777-7777-777777777777') as ws_a,
  (select id from public.workspaces where owner_id = 'b7777777-7777-7777-7777-777777777777') as ws_b;
grant select on ids to authenticated, anon, service_role;
create temp table refs (name text primary key, id uuid);
grant select, insert on refs to authenticated, service_role;

-- c7 is only a MEMBER of A's workspace (their own sign-up workspace is removed).
delete from public.workspaces where owner_id = 'c7777777-7777-7777-7777-777777777777';
insert into public.workspace_members (workspace_id, user_id, role)
select ws_a, 'c7777777-7777-7777-7777-777777777777', 'member' from ids;

update public.plans set razorpay_plan_id = 'plan_TESTstarter01' where id = 'starter';

-- Event builders (the shape of Razorpay's webhook JSON).
create function pg_temp.sub_ev(ev text, sub text, plan text, status text, ts bigint, pay jsonb default null)
returns jsonb language sql as $$
  select jsonb_build_object('entity', 'event', 'event', ev, 'created_at', ts,
    'payload', jsonb_build_object('subscription', jsonb_build_object('entity', jsonb_build_object(
        'id', sub, 'plan_id', plan, 'status', status,
        'current_end', ts + 30 * 86400)))
      || case when pay is null then '{}'::jsonb
              else jsonb_build_object('payment', jsonb_build_object('entity', pay)) end)
$$;
create function pg_temp.pay_ev(ev text, pay jsonb)
returns jsonb language sql as $$
  select jsonb_build_object('entity', 'event', 'event', ev,
    'created_at', extract(epoch from now())::bigint,
    'payload', jsonb_build_object('payment', jsonb_build_object('entity', pay)))
$$;
create function pg_temp.now_s(offset_s bigint default 0)
returns bigint language sql as $$ select extract(epoch from now())::bigint + offset_s $$;

-- ================================================================ what users can touch
set local role anon;
select is((select count(*) from public.plans)::int, 4, 'visitors can read the plans (prices)');
select is((select count(*) from public.credit_packs)::int, 1, 'visitors can read the packs');
select throws_ok($$ select count(*) from public.subscriptions $$, '42501', null,
  'visitors cannot read subscriptions');
select throws_ok($$ select count(*) from public.payments $$, '42501', null,
  'visitors cannot read payments');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a7777777-7777-7777-7777-777777777777","role":"authenticated"}', true);
select throws_ok($$ update public.plans set price_inr = 1 $$, '42501', null,
  'users cannot change prices');
select throws_ok(
  $$ insert into public.payments (workspace_id, kind, amount) select ws_a, 'subscription', 100 from ids $$,
  '42501', null, 'users cannot write payments');
select throws_ok(
  $$ update public.subscriptions set status = 'active' $$, '42501', null,
  'users cannot activate a subscription themselves');
select throws_ok(
  $$ select public.billing_prepare_subscription('a7777777-7777-7777-7777-777777777777', 'starter') $$,
  '42501', null, 'users cannot call the service-only billing functions');
select throws_ok(
  $$ select public.process_razorpay_event('evt_x', '{}') $$, '42501', null,
  'users cannot feed webhook events in');
select is((select watermark from public.billing_status((select ws_a from ids))), true,
  'a free workspace exports with the watermark');
select throws_ok($$ select * from public.billing_status((select ws_b from ids)) $$, 'P0002', null,
  'billing status of another workspace is not found');

-- ================================================================ starting a subscription
reset role;
set local role service_role;
select throws_ok(
  $$ select public.billing_prepare_subscription('a7777777-7777-7777-7777-777777777777', 'growth') $$,
  'P0001', 'plan_not_ready', 'a plan without a Razorpay plan id cannot be bought yet');
select throws_ok(
  $$ select public.billing_prepare_subscription('a7777777-7777-7777-7777-777777777777', 'free') $$,
  '22023', 'invalid_plan', 'the free plan is not sold');
select throws_ok(
  $$ select public.billing_prepare_subscription('c7777777-7777-7777-7777-777777777777', 'starter') $$,
  '42501', 'not_owner', 'a member who is not the owner cannot start a subscription');

insert into refs select 'sub_a', ref
from public.billing_prepare_subscription('a7777777-7777-7777-7777-777777777777', 'starter');
select lives_ok($$ select public.billing_attach((select id from refs where name = 'sub_a'), 'sub_TESTa0000001') $$,
  'the owner starts Starter; the Razorpay subscription id is stored');

-- ================================================================ webhook: subscription
select is(public.process_razorpay_event('evt_1',
  pg_temp.sub_ev('subscription.authenticated', 'sub_TESTa0000001', 'plan_TESTstarter01', 'authenticated', pg_temp.now_s(-100))),
  'subscription_updated', 'authenticated event updates the subscription');
select is((select available from public.credit_balances where workspace_id = (select ws_a from ids)), 10,
  'no credits before a charge');

select is(public.process_razorpay_event('evt_2',
  pg_temp.sub_ev('subscription.charged', 'sub_TESTa0000001', 'plan_TESTstarter01', 'active', pg_temp.now_s(-50),
    '{"id":"pay_TESTcheap0001","amount":100,"currency":"INR","status":"captured"}')),
  'amount_mismatch', 'a charge for the wrong amount grants nothing');
select is((select available from public.credit_balances where workspace_id = (select ws_a from ids)), 10,
  'still no credits after the wrong amount');

select is(public.process_razorpay_event('evt_3',
  pg_temp.sub_ev('subscription.charged', 'sub_TESTa0000001', 'plan_TESTstarter01', 'active', pg_temp.now_s(-40),
    '{"id":"pay_TESTmonth0001","amount":39900,"currency":"INR","status":"captured","method":"upi"}')),
  'credits_granted', 'the monthly charge grants the plan credits');
select is((select available from public.credit_balances where workspace_id = (select ws_a from ids)), 70,
  'Starter adds 60 credits');
select is(public.process_razorpay_event('evt_3', '{}'), 'duplicate', 'the same event again is ignored');
select is(public.process_razorpay_event('evt_4',
  pg_temp.sub_ev('subscription.charged', 'sub_TESTa0000001', 'plan_TESTstarter01', 'active', pg_temp.now_s(-30),
    '{"id":"pay_TESTmonth0001","amount":39900,"currency":"INR","status":"captured"}')),
  'already_granted', 'a new event for the same payment grants nothing more');
select is((select available from public.credit_balances where workspace_id = (select ws_a from ids)), 70,
  'credits granted exactly once');
select is((select status from public.subscriptions where razorpay_subscription_id = 'sub_TESTa0000001'), 'active',
  'the subscription is active');

select is(public.process_razorpay_event('evt_5',
  pg_temp.sub_ev('subscription.pending', 'sub_TESTa0000001', 'plan_TESTstarter01', 'pending', pg_temp.now_s(-90))),
  'subscription_updated', 'a late, older event is accepted…');
select is((select status from public.subscriptions where razorpay_subscription_id = 'sub_TESTa0000001'), 'active',
  '…but does not undo the newer status');
select is(public.process_razorpay_event('evt_6',
  pg_temp.sub_ev('subscription.charged', 'sub_TESTa0000001', 'plan_TESTother0001', 'active', pg_temp.now_s())),
  'plan_mismatch', 'an event for a different Razorpay plan changes nothing');
select is(public.process_razorpay_event('evt_7',
  pg_temp.sub_ev('subscription.activated', 'sub_TESTunknown01', 'plan_TESTstarter01', 'active', pg_temp.now_s())),
  'unknown_subscription', 'an unknown subscription is ignored');

select throws_ok(
  $$ select public.billing_prepare_subscription('a7777777-7777-7777-7777-777777777777', 'starter') $$,
  'P0001', 'already_subscribed', 'a second subscription for the same months is refused');

-- ================================================================ webhook: one-time pack
insert into refs select 'pack_b', ref
from public.billing_prepare_order('b7777777-7777-7777-7777-777777777777', 'festival');
select is((select amount from public.payments where id = (select id from refs where name = 'pack_b')), 9900,
  'the pack price comes from our table (₹99 = 9900 paise)');
select public.billing_attach((select id from refs where name = 'pack_b'), 'order_TESTb0000001');

select is(public.process_razorpay_event('evt_10', pg_temp.pay_ev('payment.failed',
  '{"id":"pay_TESTfail00001","order_id":"order_TESTb0000001","amount":9900,"currency":"INR","error_description":"Payment failed"}')),
  'payment_failed', 'a failed attempt is recorded');
select is(public.process_razorpay_event('evt_11', pg_temp.pay_ev('payment.captured',
  '{"id":"pay_TESTcheap0002","order_id":"order_TESTb0000001","amount":100,"currency":"INR"}')),
  'amount_mismatch', 'a pack payment for the wrong amount grants nothing');
select is(public.process_razorpay_event('evt_12', pg_temp.pay_ev('payment.captured',
  '{"id":"pay_TESTpack00001","order_id":"order_TESTb0000001","amount":9900,"currency":"INR","method":"upi"}')),
  'credits_granted', 'a retry that succeeds after the failure grants the pack');
select is((select available from public.credit_balances where workspace_id = (select ws_b from ids)), 25,
  'the festival pack adds 15 credits');
select is(public.process_razorpay_event('evt_13', pg_temp.pay_ev('payment.captured',
  '{"id":"pay_TESTpack00001","order_id":"order_TESTb0000001","amount":9900,"currency":"INR"}')),
  'already_granted', 'the pack is granted once');
select is(public.process_razorpay_event('evt_14', pg_temp.pay_ev('payment.captured',
  '{"id":"pay_TESTsubpay001","order_id":"order_TESTsubinv01","amount":39900,"currency":"INR"}')),
  'not_a_pack_payment', 'subscription payments are not granted twice through payment.captured');

-- ================================================================ refund
select is(public.process_razorpay_event('evt_15', jsonb_build_object('event', 'refund.processed',
  'payload', jsonb_build_object('refund', jsonb_build_object('entity',
    '{"id":"rfnd_TEST000001","payment_id":"pay_TESTpack00001","amount":9900,"status":"processed"}'::jsonb)))),
  'refunded', 'a full refund is processed');
select is((select available from public.credit_balances where workspace_id = (select ws_b from ids)), 10,
  'the refunded pack credits are taken back');
select is((select status from public.payments where razorpay_payment_id = 'pay_TESTpack00001'), 'refunded',
  'the payment is marked refunded');

-- ================================================================ what users see; watermark
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b7777777-7777-7777-7777-777777777777","role":"authenticated"}', true);
select is((select count(*) from public.subscriptions)::int, 0, 'B cannot see A''s subscription');

select set_config('request.jwt.claims', '{"sub":"a7777777-7777-7777-7777-777777777777","role":"authenticated"}', true);
select results_eq(
  $$ select plan_id, watermark from public.billing_status((select ws_a from ids)) $$,
  $$ values ('starter'::text, false) $$, 'a paying workspace is on Starter, without the watermark');

reset role;
insert into public.business_profiles (id, workspace_id, name, industry)
select 'a7777777-0000-0000-0000-000000000001', ws_a, 'A Cafe', 'food' from ids;
insert into public.campaigns (id, workspace_id, business_id, name)
select 'a7777777-2222-0000-0000-000000000001', ws_a, 'a7777777-0000-0000-0000-000000000001', 'Paid' from ids;
set local role authenticated;
insert into refs select 'job_a', public.create_render_job('a7777777-2222-0000-0000-000000000001', array['9:16']);
select is(
  (select (params->>'watermark')::boolean from public.generation_jobs
   where id = (select id from refs where name = 'job_a')),
  false, 'exports of a paying workspace have no watermark');
reset role;

select finish();
rollback;
