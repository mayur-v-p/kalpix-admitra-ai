-- M2 security tests: workspace isolation, column protection, storage, anonymous access.
-- Run with: npx supabase test db
-- Covers security.md Phase 20 negative tests 1-5, 7-9, 11 for the M2 tables.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

-- ---------------------------------------------------------------- setup (as postgres)
insert into auth.users (id, email, raw_user_meta_data)
values ('11111111-1111-1111-1111-111111111111', 'a@example.com', '{"full_name":"Asha"}'),
       ('22222222-2222-2222-2222-222222222222', 'b@example.com', '{"full_name":"Bilal"}'),
       ('33333333-3333-3333-3333-333333333333', 'c@example.com', '{"full_name":"Chitra"}');

create temp table ids as
select
  (select id from public.workspaces where owner_id = '11111111-1111-1111-1111-111111111111') as ws_a,
  (select id from public.workspaces where owner_id = '22222222-2222-2222-2222-222222222222') as ws_b,
  (select id from public.workspaces where owner_id = '33333333-3333-3333-3333-333333333333') as ws_c;
grant select on ids to authenticated, anon;

-- B gets a business, brand kit and logo file (created as postgres)
insert into public.business_profiles (id, workspace_id, name, industry)
select '22222222-0000-0000-0000-000000000001', ws_b, 'B Salon', 'beauty' from ids;
insert into public.brand_kits (workspace_id, business_id)
select ws_b, '22222222-0000-0000-0000-000000000001' from ids;
insert into storage.objects (bucket_id, name)
select 'brand-assets', ws_b || '/logo-b.png' from ids;
-- C has a business but no brand kit yet
insert into public.business_profiles (id, workspace_id, name, industry)
select '33333333-0000-0000-0000-000000000001', ws_c, 'C Store', 'retail' from ids;

-- ---------------------------------------------------------------- sign-up trigger
select is((select full_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Asha', 'sign-up creates a profile with the display name');
select is((select role::text from public.workspace_members m join ids on m.workspace_id = ids.ws_a
           where m.user_id = '11111111-1111-1111-1111-111111111111'),
  'owner', 'sign-up creates a workspace with the user as owner');

-- ---------------------------------------------------------------- as user A
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is((select count(*) from public.workspaces), 1::bigint, 'A sees only their own workspace');
select is((select count(*) from public.profiles), 1::bigint, 'A sees only their own profile');
select is((select count(*) from public.business_profiles), 0::bigint, 'A cannot see B''s business');
select is((select count(*) from public.brand_kits), 0::bigint, 'A cannot see B''s brand kit');
select is((select count(*) from public.workspace_members), 1::bigint, 'A sees only their own membership');
select is((select count(*) from public.audit_events), 1::bigint, 'A sees only their own audit log');
select is((select count(*) from storage.objects where bucket_id = 'brand-assets'), 0::bigint,
  'A cannot list B''s files');

select lives_ok(
  $$ insert into public.business_profiles (workspace_id, name, industry, phone)
     select ws_a, 'A Cafe', 'food', '+91 98765 43210' from ids $$,
  'A can create a business in their own workspace');

select throws_ok(
  $$ insert into public.business_profiles (id, workspace_id, name, industry)
     select gen_random_uuid(), ws_a, 'Own id', 'food' from ids $$,
  '42501', null, 'A cannot choose row ids (column grants)');
select throws_ok(
  $$ insert into public.business_profiles (workspace_id, name, industry) select ws_b, 'Hijack', 'food' from ids $$,
  '42501', null, 'A cannot create a business in B''s workspace');

select throws_ok(
  $$ insert into public.brand_kits (workspace_id, business_id)
     select ws_a, '33333333-0000-0000-0000-000000000001' from ids $$,
  '23503', null, 'A cannot attach a brand kit to another workspace''s business');

update public.business_profiles set name = 'Hacked' where id = '22222222-0000-0000-0000-000000000001';

select throws_ok(
  $$ update public.business_profiles set workspace_id = (select ws_b from ids)
     where workspace_id = (select ws_a from ids) $$,
  '42501', null, 'A cannot move a business to another workspace');

select throws_ok(
  $$ update public.business_profiles set phone_confirmed_at = now()
     where workspace_id = (select ws_a from ids) $$,
  '42501', null, 'A cannot mark a fact as confirmed directly');

select throws_ok(
  $$ update public.workspaces set owner_id = '22222222-2222-2222-2222-222222222222' $$,
  '42501', null, 'A cannot change workspace ownership');

select throws_ok(
  $$ insert into public.workspace_members (workspace_id, user_id)
     select ws_b, '11111111-1111-1111-1111-111111111111' from ids $$,
  '42501', null, 'A cannot add themselves to B''s workspace');

select throws_ok($$ select * from public.platform_admins $$, '42501', null,
  'A cannot read the platform admin list');
select is(private.is_platform_admin(), false, 'A is not a platform admin');

select throws_ok(
  $$ insert into storage.objects (bucket_id, name) select 'brand-assets', ws_b || '/evil.png' from ids $$,
  '42501', null, 'A cannot upload into B''s folder');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) select 'brand-assets', ws_a || '/logo-a.png' from ids $$,
  'A can upload into their own folder');

-- ---------------------------------------------------------------- confirmed facts reset on change
reset role;
update public.business_profiles set phone_confirmed_at = now()
where workspace_id = (select ws_a from ids);
set local role authenticated;
update public.business_profiles set phone = '+91 99999 00000'
where workspace_id = (select ws_a from ids);
reset role;
select is((select phone_confirmed_at from public.business_profiles
           where workspace_id = (select ws_a from ids)), null,
  'changing the phone number clears its confirmation');
select is((select name from public.business_profiles where id = '22222222-0000-0000-0000-000000000001'),
  'B Salon', 'A''s update to B''s business changed nothing');

-- ---------------------------------------------------------------- as user B
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*) from public.business_profiles), 1::bigint, 'B sees only B''s business');
select is((select count(*) from storage.objects where bucket_id = 'brand-assets'), 1::bigint,
  'B sees only B''s own file');

-- ---------------------------------------------------------------- anonymous (no login)
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select * from public.business_profiles $$, '42501', null,
  'anonymous visitors cannot read businesses');
select throws_ok($$ select private.is_member(gen_random_uuid()) $$, '42501', null,
  'anonymous visitors cannot call private helper functions');

select * from finish();
rollback;
