-- =====================================================================================
-- M8: free try (anonymous trial workspaces), admin console, clean-up.
--
-- Free try (architecture.md 7.3): a visitor passes the captcha and is signed in
-- anonymously; the sign-up trigger already gives them a workspace with is_trial = true.
-- The trial limits live HERE, in the database, so no client can lift them:
--   * 1 credit (not 10), 1 product, 2 campaigns;
--   * exports: the 9:16 size only, half resolution, watermark forced, and at most one
--     export per IP address per day (across all trial accounts from that address);
--   * no new AI scenes (only clips already in the cache).
-- Signing up converts the anonymous user: the work is kept and the free plan's 10 credits
-- are added. Trials that are never converted are deleted after 7 days (pg_cron).
--
-- Admin console: platform admins only (platform_admins table), and only with a second
-- factor (MFA, AAL2) in the session. Every admin change is written to audit_events.
-- =====================================================================================

-- Audit entries can carry a short detail (for example the reason for a credit change).
alter table public.audit_events
  add column detail text check (char_length(detail) <= 500);

-- -------------------------------------------------------------------------------------
-- Free try
-- -------------------------------------------------------------------------------------
create or replace function private.trial_credits()
returns integer
language sql
immutable
set search_path = ''
as $$ select 1 $$;

create or replace function private.is_trial_workspace(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select coalesce((select w.is_trial from public.workspaces w where w.id = ws), false) $$;

-- New workspaces: a trial gets 1 credit, everyone else the free plan's credits.
create or replace function private.init_workspace_credits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  amount integer := case when new.is_trial then private.trial_credits() else private.free_plan_credits() end;
begin
  insert into public.credit_balances (workspace_id, available) values (new.id, amount);
  insert into public.credit_ledger (workspace_id, kind, amount, note)
  values (new.id, 'grant', amount, case when new.is_trial then 'Free try credit' else 'Free plan credits' end);
  return new;
end;
$$;

-- Signing up from a trial: auth marks the user no longer anonymous. Keep the work, end
-- the trial and add the free plan's credits (once: only a trial workspace qualifies).
create or replace function private.handle_user_converted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid;
begin
  for ws in
    update public.workspaces set is_trial = false
      where owner_id = new.id and is_trial
      returning id
  loop
    update public.credit_balances set available = available + private.free_plan_credits()
      where workspace_id = ws;
    insert into public.credit_ledger (workspace_id, kind, amount, note)
    values (ws, 'grant', private.free_plan_credits(), 'Free plan credits (signed up)');
    insert into public.audit_events (workspace_id, actor_id, action, entity, entity_id)
    values (ws, new.id, 'workspace.trial_converted', 'workspace', ws);
  end loop;
  return new;
end;
$$;
create trigger on_auth_user_converted
  after update of is_anonymous on auth.users
  for each row when (old.is_anonymous is true and new.is_anonymous is false)
  execute function private.handle_user_converted();

-- The caller's IP address as the API gateway passed it (PostgREST request headers), hashed.
-- Null when there is no HTTP request (tests, SQL).
create or replace function private.request_ip_hash()
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  h json := nullif(current_setting('request.headers', true), '')::json;
  ip text;
begin
  if h is null then return null; end if;
  -- cf-connecting-ip (set by Cloudflare in front of hosted Supabase) cannot be faked by the
  -- caller; the first x-forwarded-for entry can, so it is only the local fallback.
  ip := coalesce(h->>'cf-connecting-ip', h->>'x-real-ip', split_part(h->>'x-forwarded-for', ',', 1));
  ip := nullif(trim(ip), '');
  if ip is null then return null; end if;
  return encode(extensions.digest(ip, 'sha256'), 'hex');
end;
$$;

create or replace function private.trial_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ip text;
begin
  if not private.is_trial_workspace(new.workspace_id) then
    return new;
  end if;

  if tg_table_name = 'products' then
    if (select count(*) from public.products p where p.workspace_id = new.workspace_id) >= 1 then
      raise exception 'trial_limit' using errcode = 'P0001', detail = 'products';
    end if;
  elsif tg_table_name = 'campaigns' then
    if (select count(*) from public.campaigns c where c.workspace_id = new.workspace_id) >= 2 then
      raise exception 'trial_limit' using errcode = 'P0001', detail = 'campaigns';
    end if;
  elsif tg_table_name = 'ai_video_clips' then
    -- Only clips already in the cache (reused, never inserted) are allowed in a trial.
    raise exception 'trial_cached_only' using errcode = 'P0001';
  elsif tg_table_name = 'generation_jobs' then
    if new.formats is distinct from array['9:16'] then
      raise exception 'trial_limit' using errcode = 'P0001', detail = 'one_size';
    end if;
    ip := private.request_ip_hash();
    if ip is not null and not public.consume_rate_limit('trial-export-ip:' || ip, 1, 86400) then
      raise exception 'trial_limit' using errcode = 'P0001', detail = 'daily_export';
    end if;
    new.params := new.params || jsonb_build_object('lowRes', true, 'watermark', true);
  end if;
  return new;
end;
$$;

create trigger trial_limits before insert on public.products
  for each row execute function private.trial_limits();
create trigger trial_limits before insert on public.campaigns
  for each row execute function private.trial_limits();
create trigger trial_limits before insert on public.ai_video_clips
  for each row execute function private.trial_limits();
create trigger trial_limits before insert on public.generation_jobs
  for each row execute function private.trial_limits();

-- Trials nobody converted are deleted after 7 days (their workspace and rows go with them
-- through the foreign keys). Files in Storage are removed by the storage clean-up job.
create or replace function private.delete_stale_trials()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  gone integer;
begin
  with stale as (
    delete from auth.users u
    where u.is_anonymous and u.created_at < now() - interval '7 days'
    returning u.id
  )
  select count(*) into gone from stale;
  return gone;
end;
$$;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('kalpix-delete-stale-trials', '17 3 * * *',
                          'select private.delete_stale_trials()');
  end if;
end;
$$;

-- -------------------------------------------------------------------------------------
-- Admin console
-- -------------------------------------------------------------------------------------
-- A platform admin who has also passed a second factor in this session.
create or replace function private.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
end;
$$;

-- Is the caller a platform admin? (Says nothing else; used to show the Admin link.)
create or replace function public.am_i_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select private.is_platform_admin() $$;

create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'users', (select count(*) from auth.users u where not coalesce(u.is_anonymous, false)),
    'users_7d', (select count(*) from auth.users u
                 where not coalesce(u.is_anonymous, false) and u.created_at > now() - interval '7 days'),
    'active_trials', (select count(*) from public.workspaces w where w.is_trial),
    'paying_workspaces', (select count(distinct s.workspace_id) from public.subscriptions s
                          where s.status = 'active'),
    'revenue_month_inr', (select coalesce(sum(p.amount - p.refunded_amount), 0) / 100
                          from public.payments p
                          where p.status in ('paid', 'refunded')
                            and p.paid_at >= date_trunc('month', now())),
    'exports_today', (select count(*) from public.generation_jobs j
                      where j.created_at >= date_trunc('day', now())),
    'exports_failed_7d', (select count(*) from public.generation_jobs j
                          where j.status = 'FAILED' and j.created_at > now() - interval '7 days'),
    'exports_waiting', (select count(*) from public.generation_jobs j
                        where j.status in ('QUEUED', 'PROCESSING')),
    'avg_render_seconds_7d', (select round(avg(extract(epoch from (j.finished_at - j.started_at)))::numeric, 1)
                              from public.generation_jobs j
                              where j.status = 'COMPLETED' and j.finished_at > now() - interval '7 days'),
    'ai_scenes_7d', (select count(*) from public.ai_video_clips c
                     where c.created_at > now() - interval '7 days'),
    'ai_scenes_failed_7d', (select count(*) from public.ai_video_clips c
                            where c.status = 'FAILED' and c.created_at > now() - interval '7 days'),
    'webhooks_24h', (select count(*) from public.webhook_events e
                     where e.received_at > now() - interval '24 hours'),
    'webhooks_unprocessed', (select count(*) from public.webhook_events e
                             where e.source = 'ai_video' and e.processed_at is null
                               and e.received_at < now() - interval '10 minutes')
  );
end;
$$;

create or replace function public.admin_find_users(p_query text default '')
returns table (
  user_id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  is_anonymous boolean,
  workspace_id uuid,
  business_name text,
  is_trial boolean,
  plan_id text,
  credits integer,
  exports integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
    select u.id, u.email::text, u.created_at, u.last_sign_in_at, coalesce(u.is_anonymous, false),
           w.id, b.name, w.is_trial,
           coalesce((private.current_subscription(w.id)).plan_id, 'free'),
           cb.available,
           (select count(*)::integer from public.generation_jobs j where j.workspace_id = w.id)
    from auth.users u
    left join public.workspaces w on w.owner_id = u.id
    left join public.business_profiles b on b.workspace_id = w.id
    left join public.credit_balances cb on cb.workspace_id = w.id
    where coalesce(p_query, '') = ''
       or u.email ilike '%' || p_query || '%'
       or b.name ilike '%' || p_query || '%'
    order by u.created_at desc
    limit 50;
end;
$$;

-- Add (positive) or remove (negative) credits, with a reason. Audited.
create or replace function public.admin_adjust_credits(p_workspace uuid, p_amount integer, p_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  bal integer;
  reason text := left(trim(coalesce(p_reason, '')), 200);
begin
  perform private.require_admin();
  if p_amount is null or p_amount = 0 or abs(p_amount) > 10000 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if char_length(reason) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  select available into bal from public.credit_balances where workspace_id = p_workspace for update;
  if bal is null then
    raise exception 'Workspace not found' using errcode = 'P0002';
  end if;
  if bal + p_amount < 0 then
    raise exception 'not_enough_credits' using errcode = 'P0001';
  end if;
  update public.credit_balances set available = available + p_amount where workspace_id = p_workspace;
  insert into public.credit_ledger (workspace_id, kind, amount, note)
  values (p_workspace, case when p_amount > 0 then 'grant' else 'adjust' end, abs(p_amount),
          'Kalpix team: ' || reason);
  insert into public.audit_events (workspace_id, actor_id, action, entity, entity_id, detail)
  values (p_workspace, auth.uid(), 'admin.credits_adjusted', 'workspace', p_workspace,
          format('%s credits: %s', p_amount, reason));
  return bal + p_amount;
end;
$$;

create or replace function public.admin_recent_failures()
returns table (kind text, id uuid, workspace_id uuid, created_at timestamptz, error text, attempts integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
    select * from (
      select 'export'::text, j.id, j.workspace_id, j.created_at, j.error, j.attempts
      from public.generation_jobs j where j.status = 'FAILED'
      union all
      select 'ai_scene'::text, c.id, c.workspace_id, c.created_at, c.error, null::integer
      from public.ai_video_clips c where c.status = 'FAILED'
    ) f
    order by 4 desc
    limit 50;
end;
$$;

create or replace function public.admin_audit_log(p_limit integer default 100)
returns table (
  created_at timestamptz,
  actor_email text,
  action text,
  entity text,
  entity_id uuid,
  workspace_id uuid,
  detail text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
    select a.created_at, u.email::text, a.action, a.entity, a.entity_id, a.workspace_id, a.detail
    from public.audit_events a
    left join auth.users u on u.id = a.actor_id
    order by a.created_at desc, a.id desc
    limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

-- Plans: link the Razorpay plan id, credits, on/off. The PRICE is not editable here: it
-- must equal the Razorpay plan's amount, so a new price means a new Razorpay plan.
create or replace function public.admin_update_plan(
  p_plan text,
  p_razorpay_plan_id text,
  p_monthly_credits integer,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  if p_monthly_credits is null or p_monthly_credits < 0 or p_monthly_credits > 100000 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  update public.plans
    set razorpay_plan_id = nullif(trim(p_razorpay_plan_id), ''),
        monthly_credits = p_monthly_credits,
        active = coalesce(p_active, active)
    where id = p_plan;
  if not found then
    raise exception 'Plan not found' using errcode = 'P0002';
  end if;
  insert into public.audit_events (actor_id, action, entity, detail)
  values (auth.uid(), 'admin.plan_updated', 'plan',
          format('%s: razorpay %s, %s credits, active %s', p_plan,
                 coalesce(nullif(trim(p_razorpay_plan_id), ''), 'none'), p_monthly_credits, p_active));
end;
$$;

create or replace function public.admin_update_scene_type(p_id text, p_active boolean, p_credit_cost integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  if p_credit_cost is null or p_credit_cost < 0 or p_credit_cost > 100 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  update public.ai_scene_types set active = p_active, credit_cost = p_credit_cost where id = p_id;
  if not found then
    raise exception 'Scene type not found' using errcode = 'P0002';
  end if;
  insert into public.audit_events (actor_id, action, entity, detail)
  values (auth.uid(), 'admin.scene_type_updated', 'ai_scene_type',
          format('%s: active %s, %s credits', p_id, p_active, p_credit_cost));
end;
$$;

-- -------------------------------------------------------------------------------------
-- Grants
-- -------------------------------------------------------------------------------------
revoke all on function private.trial_credits() from public;
revoke all on function private.is_trial_workspace(uuid) from public;
revoke all on function private.handle_user_converted() from public;
revoke all on function private.request_ip_hash() from public;
revoke all on function private.trial_limits() from public;
revoke all on function private.delete_stale_trials() from public;
revoke all on function private.require_admin() from public;

revoke all on function public.am_i_platform_admin() from public, anon;
revoke all on function public.admin_overview() from public, anon;
revoke all on function public.admin_find_users(text) from public, anon;
revoke all on function public.admin_adjust_credits(uuid, integer, text) from public, anon;
revoke all on function public.admin_recent_failures() from public, anon;
revoke all on function public.admin_audit_log(integer) from public, anon;
revoke all on function public.admin_update_plan(text, text, integer, boolean) from public, anon;
revoke all on function public.admin_update_scene_type(text, boolean, integer) from public, anon;
grant execute on function public.am_i_platform_admin() to authenticated;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_find_users(text) to authenticated;
grant execute on function public.admin_adjust_credits(uuid, integer, text) to authenticated;
grant execute on function public.admin_recent_failures() to authenticated;
grant execute on function public.admin_audit_log(integer) to authenticated;
grant execute on function public.admin_update_plan(text, text, integer, boolean) to authenticated;
grant execute on function public.admin_update_scene_type(text, boolean, integer) to authenticated;
