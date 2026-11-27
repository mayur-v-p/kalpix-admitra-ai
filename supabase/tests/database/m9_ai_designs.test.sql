-- M9 security tests: sectors, confirmed business details, campaign purpose/design, and the
-- real-estate registration rule on exports.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('a9999999-9999-9999-9999-999999999999', 'a9@example.com'),
  ('b9999999-9999-9999-9999-999999999999', 'b9@example.com');

create temp table ids as
select
  (select id from public.workspaces where owner_id = 'a9999999-9999-9999-9999-999999999999') as ws_a,
  (select id from public.workspaces where owner_id = 'b9999999-9999-9999-9999-999999999999') as ws_b;
grant select on ids to authenticated, anon;

insert into public.business_profiles (id, workspace_id, name, industry)
select 'b9999999-0000-0000-0000-000000000001', ws_b, 'B Clinic', 'clinic' from ids;
-- Plenty of credits for A, so only the fact gate decides.
update public.credit_balances set available = 100 where workspace_id = (select ws_a from ids);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a9999999-9999-9999-9999-999999999999","role":"authenticated"}', true);

select lives_ok(
  $$ insert into public.business_profiles (workspace_id, name, industry, opening_hours, specialities, registration_no)
     select ws_a, 'Sky Heights', 'real_estate', '10 AM – 7 PM',
            array['2 BHK', '3 BHK'], 'P52100012345' from ids $$,
  'A can create a real-estate business with hours, specialities and a RERA number');
select throws_ok(
  $$ update public.business_profiles set industry = 'casino' where id = (select id from public.business_profiles where name = 'Sky Heights') $$,
  '23514', null, 'only known sectors are accepted');
select throws_ok(
  $$ update public.business_profiles set specialities = array['this speciality name is far too long'] where id = (select id from public.business_profiles where name = 'Sky Heights') $$,
  '23514', null, 'specialities are kept short');
select throws_ok(
  $$ update public.business_profiles set details_confirmed_at = now() where id = (select id from public.business_profiles where name = 'Sky Heights') $$,
  '42501', null, 'A cannot confirm details by editing the column');
select throws_ok($$ select public.confirm_business_details('b9999999-0000-0000-0000-000000000001') $$,
  'P0002', null, 'A cannot confirm B''s business details');

reset role;
insert into public.campaigns (id, workspace_id, business_id, name, purpose, style_id, design)
select 'a9999999-2222-0000-0000-000000000001', ws_a, (select id from public.business_profiles where name = 'Sky Heights'), 'Launch',
       'opening', 'composer', '{"v":1,"layout":"spotlight"}'::jsonb from ids;
set local role authenticated;
select throws_ok(
  $$ update public.campaigns set purpose = 'spam' where id = 'a9999999-2222-0000-0000-000000000001' $$,
  '23514', null, 'only known purposes are accepted');
select throws_ok(
  $$ update public.campaigns set design = '"just text"'::jsonb where id = 'a9999999-2222-0000-0000-000000000001' $$,
  '23514', null, 'a design must be a JSON object');
select throws_ok(
  $$ update public.campaigns set design = jsonb_build_object('x', repeat('a', 20000)) where id = 'a9999999-2222-0000-0000-000000000001' $$,
  '23514', null, 'a design cannot be huge');

select throws_ok(
  $$ select public.create_render_job('a9999999-2222-0000-0000-000000000001', array['9:16']) $$,
  'P0001', 'facts_not_confirmed', 'a real-estate ad with unconfirmed RERA/details cannot be exported');

select isnt(public.confirm_business_details((select id from public.business_profiles where name = 'Sky Heights')), null,
  'A can confirm their own business details');
select isnt(public.create_render_job('a9999999-2222-0000-0000-000000000001', array['9:16']), null,
  'with confirmed details the AI-designed ad can be exported');
select is((select params -> 'business' ->> 'registration_no' from public.generation_jobs
           where campaign_id = 'a9999999-2222-0000-0000-000000000001'),
  'P52100012345', 'the export snapshot carries the confirmed RERA number');

update public.business_profiles set opening_hours = '9 AM – 9 PM' where id = (select id from public.business_profiles where name = 'Sky Heights');
select is((select details_confirmed_at from public.business_profiles where id = (select id from public.business_profiles where name = 'Sky Heights')),
  null, 'changing the hours clears the confirmation');

select * from finish();
rollback;
