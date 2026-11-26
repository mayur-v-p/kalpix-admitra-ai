-- M8 security tests: free-try limits (enforced by the database), trial conversion,
-- stale-trial clean-up, and the admin console (platform admin + MFA, audited changes).
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

-- t1, t2: anonymous visitors (free try). n: a normal owner. adm: a platform admin.
insert into auth.users (id, email, is_anonymous) values
  ('a8888888-0000-0000-0000-000000000001', null, true),
  ('a8888888-0000-0000-0000-000000000002', null, true),
  ('a8888888-0000-0000-0000-000000000003', 'n8@example.com', false),
  ('a8888888-0000-0000-0000-000000000004', 'admin8@example.com', false);
insert into public.platform_admins (user_id) values ('a8888888-0000-0000-0000-000000000004');

create temp table ids as
select
  (select id from public.workspaces where owner_id = 'a8888888-0000-0000-0000-000000000001') as t1,
  (select id from public.workspaces where owner_id = 'a8888888-0000-0000-0000-000000000002') as t2,
  (select id from public.workspaces where owner_id = 'a8888888-0000-0000-0000-000000000003') as n;
grant select on ids to authenticated, anon, service_role;
create temp table camp (id uuid);
grant select, insert on camp to authenticated;

insert into public.business_profiles (id, workspace_id, name, industry)
select 'b8888888-0000-0000-0000-000000000001'::uuid, t1, 'Try Cafe', 'food' from ids union all
select 'b8888888-0000-0000-0000-000000000002', t2, 'Try Shop', 'retail' from ids union all
select 'b8888888-0000-0000-0000-000000000003', n, 'Real Shop', 'retail' from ids;

-- ================================================================ trial workspace
select is((select is_trial from public.workspaces where id = (select t1 from ids)), true,
  'an anonymous visitor gets a trial workspace');
select is((select available from public.credit_balances where workspace_id = (select t1 from ids)), 1,
  'a trial starts with 1 credit, not 10');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a8888888-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":true}', true);
select lives_ok(
  $$ insert into public.products (workspace_id, business_id, name) select t1, 'b8888888-0000-0000-0000-000000000001', 'Chai' from ids $$,
  'a trial can add one product');
select throws_ok(
  $$ insert into public.products (workspace_id, business_id, name) select t1, 'b8888888-0000-0000-0000-000000000001', 'Coffee' from ids $$,
  'P0001', 'trial_limit', 'a trial cannot add a second product');
select lives_ok(
  $$ with c as (insert into public.campaigns (workspace_id, business_id, name)
       select t1, 'b8888888-0000-0000-0000-000000000001', 'One' from ids returning id)
     insert into camp select id from c $$,
  'a trial can create a campaign');
select lives_ok(
  $$ insert into public.campaigns (workspace_id, business_id, name) select t1, 'b8888888-0000-0000-0000-000000000001', 'Two' from ids $$,
  'and a second one');
select throws_ok(
  $$ insert into public.campaigns (workspace_id, business_id, name) select t1, 'b8888888-0000-0000-0000-000000000001', 'Three' from ids $$,
  'P0001', 'trial_limit', 'but not a third');
select throws_ok($$ update public.workspaces set is_trial = false $$, '42501', null,
  'a visitor cannot end their own trial');

select throws_ok(
  $$ select public.create_render_job((select id from camp), array['1:1']) $$,
  'P0001', 'trial_limit', 'a trial can export the 9:16 size only');

select set_config('request.headers', '{"x-forwarded-for":"203.0.113.7, 10.0.0.1"}', true);
create temp table job1 as
select public.create_render_job((select id from camp), array['9:16']) as id;
reset role;
select results_eq(
  $$ select (params->>'lowRes')::boolean, (params->>'watermark')::boolean from public.generation_jobs
     where id = (select id from job1) $$,
  $$ values (true, true) $$, 'the trial export is low resolution and watermarked');

-- Another trial account from the same IP address on the same day.
insert into public.campaigns (id, workspace_id, business_id, name)
select 'c8888888-0000-0000-0000-000000000002', t2, 'b8888888-0000-0000-0000-000000000002', 'T2' from ids;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a8888888-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":true}', true);
select set_config('request.headers', '{"x-forwarded-for":"203.0.113.7"}', true);
select throws_ok(
  $$ select public.create_render_job('c8888888-0000-0000-0000-000000000002', array['9:16']) $$,
  'P0001', 'trial_limit', 'one trial export per IP address per day, across trial accounts');
select set_config('request.headers', '{"x-forwarded-for":"198.51.100.9"}', true);
select lives_ok(
  $$ select public.create_render_job('c8888888-0000-0000-0000-000000000002', array['9:16']) $$,
  'a different address can still try');
reset role;

select throws_ok(
  $$ insert into public.ai_video_clips (workspace_id, product_id, scene_type_id, source_image_path, provider, model,
       prompt_version, aspect_ratio, mode, status, cache_key)
     select t1, (select id from public.products where workspace_id = t1), 'steam_closeup', t1 || '/x.png', 'mock', 'm', 1,
       '9:16', 'composite', 'QUEUED', md5('x') from ids $$,
  'P0001', 'trial_cached_only', 'a trial cannot start a new AI scene');

-- A normal workspace has none of these limits.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a8888888-0000-0000-0000-000000000003","role":"authenticated"}', true);
select lives_ok(
  $$ insert into public.products (workspace_id, business_id, name)
     select n, 'b8888888-0000-0000-0000-000000000003', p from ids, (values ('A'), ('B')) v(p) $$,
  'a normal workspace can add several products');
reset role;

-- ================================================================ signing up keeps the work
update auth.users set is_anonymous = false, email = 't1@example.com'
  where id = 'a8888888-0000-0000-0000-000000000001';
select is((select is_trial from public.workspaces where id = (select t1 from ids)), false,
  'signing up ends the trial');
select is((select available from public.credit_balances where workspace_id = (select t1 from ids)), 10,
  'and adds the free plan''s 10 credits (the trial credit was spent)');
select is((select count(*)::int from public.products where workspace_id = (select t1 from ids)), 1,
  'the trial work is kept');
update auth.users set email = 't1b@example.com' where id = 'a8888888-0000-0000-0000-000000000001';
select is((select available from public.credit_balances where workspace_id = (select t1 from ids)), 10,
  'later account changes add nothing');

-- ================================================================ stale trials
update auth.users set created_at = now() - interval '8 days' where id = 'a8888888-0000-0000-0000-000000000002';
select is(private.delete_stale_trials(), 1, 'trials older than 7 days are deleted');
select is((select count(*)::int from public.workspaces where id = (select t2 from ids)), 0,
  'with their workspace');

-- ================================================================ admin console
set local role anon;
select throws_ok($$ select public.admin_overview() $$, '42501', null, 'visitors cannot open the admin console');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a8888888-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);
select is(public.am_i_platform_admin(), false, 'a normal owner is not an admin');
select throws_ok($$ select public.admin_overview() $$, '42501', 'admin_only', 'a normal owner is refused');

select set_config('request.jwt.claims', '{"sub":"a8888888-0000-0000-0000-000000000004","role":"authenticated","aal":"aal1"}', true);
select is(public.am_i_platform_admin(), true, 'the admin is recognised');
select throws_ok($$ select public.admin_overview() $$, '42501', 'mfa_required',
  'an admin without a second factor is refused');

select set_config('request.jwt.claims', '{"sub":"a8888888-0000-0000-0000-000000000004","role":"authenticated","aal":"aal2"}', true);
select ok((public.admin_overview()) ? 'revenue_month_inr', 'an admin with MFA sees the overview');
select is((select email from public.admin_find_users('Real Shop')), 'n8@example.com', 'admins can find a user by business name or email');
select is(public.admin_adjust_credits((select n from ids), 5, 'Goodwill for a failed export'), 15,
  'admins can add credits, with a reason');
select is((select detail from public.admin_audit_log(1)), '5 credits: Goodwill for a failed export',
  'the change is in the audit log with its reason');
select throws_ok($$ select public.admin_adjust_credits((select n from ids), -500, 'Too many') $$,
  'P0001', 'not_enough_credits', 'credits cannot go below zero');
select throws_ok($$ select public.admin_adjust_credits((select n from ids), 1, '') $$,
  '22023', 'reason_required', 'a reason is required');
select lives_ok($$ select public.admin_update_plan('starter', 'plan_ADMINtest0001', 60, true) $$,
  'admins can link a Razorpay plan id');
reset role;

select finish();
rollback;
