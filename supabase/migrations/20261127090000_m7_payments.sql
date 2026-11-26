-- =====================================================================================
-- M7: payments with Razorpay (payment-gateway.md, architecture.md section 6).
--
-- The rules, in plain words:
--  * Prices live ONLY in `plans` and `credit_packs`. The browser sends a plan or pack id,
--    never an amount.
--  * Only the signed Razorpay webhook grants paid access or credits. The browser's
--    "payment successful" callback is never trusted.
--  * Every webhook event is handled by ONE function in ONE transaction: it records the
--    event id (a repeat does nothing), checks the amount against our own price, and grants
--    credits at most once per Razorpay payment id. If anything fails, nothing is kept and
--    Razorpay retries the event.
--  * Payment tables are read-only for users (their own workspace); all writes go through
--    the service-only functions below, called by the Edge Functions.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- What is sold
-- -------------------------------------------------------------------------------------
create table public.plans (
  id text primary key check (id ~ '^[a-z_]{2,30}$'),
  name text not null check (char_length(name) between 1 and 40),
  price_inr integer not null check (price_inr >= 0),
  monthly_credits integer not null check (monthly_credits >= 0),
  -- Plan id created in the Razorpay dashboard (plan_...). Null = not buyable yet.
  razorpay_plan_id text unique check (razorpay_plan_id ~ '^plan_[A-Za-z0-9]{6,30}$'),
  audience text not null default '',
  features text[] not null default '{}',
  highlighted boolean not null default false,
  sort integer not null default 0,
  active boolean not null default true
);

create table public.credit_packs (
  id text primary key check (id ~ '^[a-z_]{2,30}$'),
  name text not null check (char_length(name) between 1 and 40),
  price_inr integer not null check (price_inr >= 1),
  credits integer not null check (credits > 0),
  description text not null default '',
  -- How long a pack also removes the watermark (paid access), in days.
  access_days integer not null default 30 check (access_days between 0 and 365),
  active boolean not null default true
);

-- Prices and credits are hypotheses (PRD section 10). 1 credit = one export size; an AI
-- scene costs 2.
insert into public.plans (id, name, price_inr, monthly_credits, audience, features, highlighted, sort) values
  ('free', 'Free', 0, 10, 'Try Kalpix with your own product',
   array['10 credits to start', 'Posters and Outline Highlight videos', 'Brand kit and product library', 'Watermarked exports'], false, 0),
  ('starter', 'Starter', 399, 60, 'Solo local business',
   array['60 credits every month', 'Posters and Outline Highlight videos', 'AI video scenes', 'All standard sizes, no watermark'], false, 1),
  ('growth', 'Growth', 899, 150, 'Businesses running regular campaigns',
   array['150 credits every month', 'All 2D signature styles and the mascot', 'More AI video scenes', 'Voiceover and ad variants'], true, 2),
  ('agency', 'Agency', 1999, 400, 'Freelancers and small agencies',
   array['400 credits every month', 'Several client workspaces', 'Shared assets', 'Everything in Growth'], false, 3);

insert into public.credit_packs (id, name, price_inr, credits, description) values
  ('festival', 'Festival pack', 99, 15,
   'One festival campaign in several sizes: 15 credits and no watermark for 30 days. Pay once, no subscription.');

-- -------------------------------------------------------------------------------------
-- Subscriptions and payments
-- -------------------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  plan_id text not null references public.plans (id),
  razorpay_subscription_id text unique check (razorpay_subscription_id ~ '^sub_[A-Za-z0-9]{6,30}$'),
  -- Razorpay's statuses; 'created' = checkout not completed yet.
  status text not null default 'created' check (status in
    ('created', 'authenticated', 'active', 'pending', 'halted', 'cancelled', 'completed', 'expired', 'paused')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  -- created_at of the newest Razorpay event applied, so a late, older event can't undo a newer one.
  last_event_at bigint not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_workspace_id_idx on public.subscriptions (workspace_id, created_at desc);
-- At most one live subscription per workspace.
create unique index subscriptions_one_live_idx on public.subscriptions (workspace_id)
  where status in ('authenticated', 'active', 'pending');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null check (kind in ('subscription', 'pack')),
  plan_id text references public.plans (id),
  pack_id text references public.credit_packs (id),
  subscription_id uuid references public.subscriptions (id) on delete set null,
  razorpay_order_id text unique check (razorpay_order_id ~ '^order_[A-Za-z0-9]{6,30}$'),
  razorpay_payment_id text unique check (razorpay_payment_id ~ '^pay_[A-Za-z0-9]{6,30}$'),
  amount integer not null check (amount > 0), -- paise
  currency text not null default 'INR' check (currency = 'INR'),
  status text not null default 'created' check (status in ('created', 'paid', 'failed', 'refunded')),
  credits integer not null default 0 check (credits >= 0),
  credits_removed integer not null default 0 check (credits_removed >= 0),
  refunded_amount integer not null default 0 check (refunded_amount >= 0),
  method text check (char_length(method) <= 20),
  error text check (char_length(error) <= 200),
  paid_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'pack') = (pack_id is not null))
);
create index payments_workspace_id_idx on public.payments (workspace_id, created_at desc);

create trigger set_updated_at before update on public.subscriptions
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.payments
  for each row execute function private.set_updated_at();

-- Credit history can point at the payment that granted (or took back) credits.
alter table public.credit_ledger
  add column payment_id uuid references public.payments (id) on delete set null;

-- -------------------------------------------------------------------------------------
-- Access: who has paid
-- -------------------------------------------------------------------------------------
-- The paid plan a workspace is on right now, or null for the free plan. A cancelled,
-- halted or retrying subscription keeps its plan until the end of the period already paid.
create or replace function private.current_subscription(ws uuid)
returns public.subscriptions
language sql
stable
security definer
set search_path = ''
as $$
  select s.* from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.workspace_id = ws and p.price_inr > 0
    and (s.status = 'active'
         or (s.status in ('pending', 'halted', 'cancelled', 'completed', 'paused')
             and s.current_period_end > now()))
  order by s.current_period_end desc nulls last
  limit 1
$$;

-- True if exports should have no watermark: a paid plan, or a pack bought recently.
create or replace function private.has_paid_access(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (private.current_subscription(ws)).id is not null
      or exists (select 1 from public.payments pay
                 join public.credit_packs k on k.id = pay.pack_id
                 where pay.workspace_id = ws and pay.kind = 'pack' and pay.status = 'paid'
                   and pay.paid_at > now() - make_interval(days => k.access_days));
$$;

-- What the billing page and the Studio need to know, for members of the workspace.
create or replace function public.billing_status(p_workspace uuid)
returns table (
  plan_id text,
  plan_name text,
  subscription_status text,
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  watermark boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.subscriptions;
begin
  if not private.is_member(p_workspace) then
    raise exception 'Workspace not found' using errcode = 'P0002';
  end if;
  s := private.current_subscription(p_workspace);
  return query
    select coalesce(s.plan_id, 'free'),
           (select p.name from public.plans p where p.id = coalesce(s.plan_id, 'free')),
           s.status, s.current_period_end, coalesce(s.cancel_at_period_end, false),
           not private.has_paid_access(p_workspace);
end;
$$;

-- -------------------------------------------------------------------------------------
-- Starting a payment (service role only; called by the Edge Functions after they have
-- verified the user's JWT). The user id comes from the verified token; the workspace is
-- the user's own and must be one they OWN; the price comes from our tables.
-- -------------------------------------------------------------------------------------
create or replace function private.owned_workspace(p_user uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  m public.workspace_members;
begin
  -- The same workspace the app shows: the user's first membership.
  select * into m from public.workspace_members
    where user_id = p_user order by created_at limit 1;
  if m.workspace_id is null then
    raise exception 'no_workspace' using errcode = 'P0002';
  end if;
  if m.role <> 'owner' then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  return m.workspace_id;
end;
$$;

create or replace function public.billing_prepare_subscription(p_user uuid, p_plan text)
returns table (ref uuid, workspace_id uuid, razorpay_plan_id text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid := private.owned_workspace(p_user);
  pl public.plans;
  row_id uuid;
begin
  select * into pl from public.plans where id = p_plan and active;
  if pl.id is null or pl.price_inr = 0 then
    raise exception 'invalid_plan' using errcode = '22023';
  end if;
  if pl.razorpay_plan_id is null then
    raise exception 'plan_not_ready' using errcode = 'P0001';
  end if;
  if not public.consume_rate_limit('billing:' || ws, 10, 3600) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  -- Paying twice for the same months is not possible: a live or still-paid subscription
  -- must end first (plan changes come later).
  if exists (select 1 from public.subscriptions s
             where s.workspace_id = ws and s.status in ('authenticated', 'active', 'pending'))
     or (private.current_subscription(ws)).id is not null then
    raise exception 'already_subscribed' using errcode = 'P0001';
  end if;
  -- Checkouts that were opened and abandoned are closed off.
  update public.subscriptions s set status = 'expired'
    where s.workspace_id = ws and s.status = 'created';

  insert into public.subscriptions (workspace_id, plan_id, created_by)
  values (ws, pl.id, p_user)
  returning id into row_id;
  insert into public.audit_events (workspace_id, actor_id, action, entity, entity_id)
  values (ws, p_user, 'subscription.started', 'subscription', row_id);
  return query select row_id, ws, pl.razorpay_plan_id;
end;
$$;

create or replace function public.billing_prepare_order(p_user uuid, p_pack text)
returns table (ref uuid, amount integer, currency text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid := private.owned_workspace(p_user);
  k public.credit_packs;
  row_id uuid;
begin
  select * into k from public.credit_packs where id = p_pack and active;
  if k.id is null then
    raise exception 'invalid_pack' using errcode = '22023';
  end if;
  if not public.consume_rate_limit('billing:' || ws, 10, 3600) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.payments (workspace_id, kind, pack_id, amount, credits, created_by)
  values (ws, 'pack', k.id, k.price_inr * 100, k.credits, p_user)
  returning id into row_id;
  insert into public.audit_events (workspace_id, actor_id, action, entity, entity_id)
  values (ws, p_user, 'pack.order_started', 'payment', row_id);
  return query select row_id, k.price_inr * 100, 'INR'::text;
end;
$$;

-- Store the id Razorpay gave the subscription or order we just created.
create or replace function public.billing_attach(p_ref uuid, p_razorpay_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_razorpay_id like 'sub\_%' then
    update public.subscriptions set razorpay_subscription_id = p_razorpay_id
      where id = p_ref and status = 'created' and razorpay_subscription_id is null;
  elsif p_razorpay_id like 'order\_%' then
    update public.payments set razorpay_order_id = p_razorpay_id
      where id = p_ref and status = 'created' and razorpay_order_id is null;
  end if;
  if not found then
    raise exception 'Payment reference not found' using errcode = 'P0002';
  end if;
end;
$$;

-- Razorpay refused to create it: close our row so it can't be paid later.
create or replace function public.billing_abandon(p_ref uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.subscriptions set status = 'expired' where id = p_ref and status = 'created';
  update public.payments set status = 'failed', error = 'Could not start the payment.'
    where id = p_ref and status = 'created';
$$;

-- Cancelling: the owner's live subscription. Paid months are kept (cancel at period end).
create or replace function public.billing_prepare_cancel(p_user uuid)
returns table (ref uuid, razorpay_subscription_id text, subscription_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid := private.owned_workspace(p_user);
  s public.subscriptions;
begin
  select * into s from public.subscriptions x
    where x.workspace_id = ws and x.status in ('authenticated', 'active', 'pending', 'halted')
      and x.razorpay_subscription_id is not null and not x.cancel_at_period_end
    order by x.created_at desc limit 1;
  if s.id is null then
    raise exception 'no_subscription' using errcode = 'P0002';
  end if;
  return query select s.id, s.razorpay_subscription_id, s.status;
end;
$$;

create or replace function public.billing_mark_cancel(p_ref uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid;
begin
  update public.subscriptions set cancel_at_period_end = true
    where id = p_ref returning workspace_id into ws;
  if ws is not null then
    insert into public.audit_events (workspace_id, actor_id, action, entity, entity_id)
    values (ws, p_user, 'subscription.cancel_requested', 'subscription', p_ref);
  end if;
end;
$$;

-- -------------------------------------------------------------------------------------
-- Credits from payments
-- -------------------------------------------------------------------------------------
create or replace function private.grant_credits(p_workspace uuid, p_amount integer, p_payment uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_amount <= 0 then return; end if;
  insert into public.credit_balances (workspace_id, available) values (p_workspace, 0)
    on conflict (workspace_id) do nothing;
  update public.credit_balances set available = available + p_amount
    where workspace_id = p_workspace;
  insert into public.credit_ledger (workspace_id, kind, amount, payment_id, note)
  values (p_workspace, 'grant', p_amount, p_payment, p_note);
end;
$$;

-- -------------------------------------------------------------------------------------
-- The webhook: one Razorpay event, verified by the Edge Function (signature over the raw
-- body), handled here in one transaction. Returns what happened, for the logs.
-- -------------------------------------------------------------------------------------
create or replace function public.process_razorpay_event(p_event_id text, p_event jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  ev text := p_event->>'event';
  ev_at bigint := coalesce((p_event->>'created_at')::bigint, 0);
  rs jsonb := p_event #> '{payload,subscription,entity}';
  rp jsonb := p_event #> '{payload,payment,entity}';
  rr jsonb := p_event #> '{payload,refund,entity}';
  s public.subscriptions;
  pl public.plans;
  pay public.payments;
  new_status text;
  amt integer;
  pay_id uuid;
  take integer;
  bal integer;
begin
  -- 1. Each event once. A repeat (Razorpay retries) is acknowledged and ignored.
  insert into public.webhook_events (source, event_id) values ('razorpay', p_event_id)
    on conflict (source, event_id) do nothing;
  if not found then
    return 'duplicate';
  end if;

  -- 2. Subscription events: keep our status in step with Razorpay's.
  if ev like 'subscription.%' then
    select * into s from public.subscriptions
      where razorpay_subscription_id = rs->>'id' for update;
    if s.id is null then
      return 'unknown_subscription';
    end if;
    select * into pl from public.plans where id = s.plan_id;
    if rs->>'plan_id' is distinct from pl.razorpay_plan_id then
      return 'plan_mismatch'; -- not the plan we sold: change nothing
    end if;

    -- Events can arrive out of order: only a newer event changes the status.
    new_status := rs->>'status';
    if ev_at >= s.last_event_at and new_status in
       ('authenticated', 'active', 'pending', 'halted', 'cancelled', 'completed', 'expired', 'paused') then
      update public.subscriptions
        set status = new_status, last_event_at = ev_at,
            current_period_end = greatest(current_period_end,
              to_timestamp(nullif(rs->>'current_end', '')::bigint))
        where id = s.id;
    elsif rs->>'current_end' is not null then
      update public.subscriptions
        set current_period_end = greatest(current_period_end, to_timestamp((rs->>'current_end')::bigint))
        where id = s.id;
    end if;

    -- 3. A successful monthly charge: the plan's credits, once per Razorpay payment.
    if ev = 'subscription.charged' and rp is not null then
      amt := (rp->>'amount')::integer;
      if rp->>'currency' is distinct from 'INR' or amt is distinct from pl.price_inr * 100 then
        return 'amount_mismatch'; -- recorded, nothing granted; checked by hand
      end if;
      insert into public.payments
        (workspace_id, kind, plan_id, subscription_id, razorpay_payment_id, amount, status,
         credits, method, paid_at)
      values (s.workspace_id, 'subscription', pl.id, s.id, rp->>'id', amt, 'paid',
              pl.monthly_credits, left(rp->>'method', 20), now())
      on conflict (razorpay_payment_id) do nothing
      returning id into pay_id;
      if pay_id is null then
        return 'already_granted';
      end if;
      perform private.grant_credits(s.workspace_id, pl.monthly_credits, pay_id,
                                    pl.name || ' plan: monthly credits');
      return 'credits_granted';
    end if;
    return 'subscription_updated';
  end if;

  -- 4. One-time packs (orders). Subscription charges also send payment.* events; those
  --    have no pack order of ours and are ignored here (handled by subscription.charged).
  if ev in ('payment.captured', 'payment.failed') then
    select * into pay from public.payments
      where razorpay_order_id = rp->>'order_id' and kind = 'pack' for update;
    if pay.id is null then
      return 'not_a_pack_payment';
    end if;

    if ev = 'payment.failed' then
      -- A failed attempt can be followed by a successful one (UPI retries): only a
      -- payment that hasn't succeeded is marked failed.
      update public.payments
        set status = 'failed', error = left(coalesce(rp->>'error_description', 'Payment failed'), 200)
        where id = pay.id and status = 'created';
      return 'payment_failed';
    end if;

    if pay.status in ('paid', 'refunded') then
      return 'already_granted';
    end if;
    if rp->>'currency' is distinct from pay.currency
       or (rp->>'amount')::integer is distinct from pay.amount then
      return 'amount_mismatch';
    end if;
    update public.payments
      set status = 'paid', razorpay_payment_id = rp->>'id', method = left(rp->>'method', 20),
          error = null, paid_at = now()
      where id = pay.id;
    perform private.grant_credits(pay.workspace_id, pay.credits, pay.id,
      (select k.name from public.credit_packs k where k.id = pay.pack_id) || ': credits');
    return 'credits_granted';
  end if;

  -- 5. Refunds: take back the share of credits that is still unspent.
  if ev = 'refund.processed' then
    select * into pay from public.payments
      where razorpay_payment_id = rr->>'payment_id' for update;
    if pay.id is null then
      return 'unknown_payment';
    end if;
    amt := least((rr->>'amount')::integer, pay.amount - pay.refunded_amount);
    if amt is null or amt <= 0 then
      return 'nothing_to_refund';
    end if;
    take := least(
      pay.credits - pay.credits_removed,
      ceil(pay.credits::numeric * (pay.refunded_amount + amt) / pay.amount)::integer - pay.credits_removed);
    select available into bal from public.credit_balances
      where workspace_id = pay.workspace_id for update;
    take := greatest(least(take, coalesce(bal, 0)), 0); -- never below zero
    update public.payments
      set refunded_amount = refunded_amount + amt,
          credits_removed = credits_removed + take,
          status = case when refunded_amount + amt >= amount then 'refunded' else status end
      where id = pay.id;
    if take > 0 then
      update public.credit_balances set available = available - take
        where workspace_id = pay.workspace_id;
      insert into public.credit_ledger (workspace_id, kind, amount, payment_id, note)
      values (pay.workspace_id, 'refund', take, pay.id, 'Payment refunded: credits removed');
    end if;
    return 'refunded';
  end if;

  return 'ignored';
end;
$$;

-- -------------------------------------------------------------------------------------
-- Export: same as M6, but paid workspaces export without the watermark.
-- -------------------------------------------------------------------------------------
create or replace function public.create_render_job(p_campaign_id uuid, p_formats text[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.campaigns%rowtype;
  b public.business_profiles%rowtype;
  loc public.business_locations%rowtype;
  kit public.brand_kits%rowtype;
  p public.products%rowtype;
  clip public.ai_video_clips%rowtype;
  scene public.ai_scene_types%rowtype;
  formats text[];
  missing text[] := array[]::text[];
  cost integer;
  bal public.credit_balances%rowtype;
  job uuid;
  snapshot jsonb;
begin
  select * into c from public.campaigns where id = p_campaign_id;
  if c.id is null or not private.is_member(c.workspace_id) then
    raise exception 'Campaign not found' using errcode = 'P0002';
  end if;

  select array_agg(f order by array_position(array['9:16', '1:1', '4:5', '16:9'], f))
    into formats
  from (select distinct unnest(p_formats) as f) s;
  if formats is null or not formats <@ array['9:16', '1:1', '4:5', '16:9'] then
    raise exception 'invalid_formats' using errcode = '22023';
  end if;

  if not public.consume_rate_limit('render:' || c.workspace_id, 20, 3600) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.generation_jobs j
             where j.campaign_id = c.id and j.status in ('QUEUED', 'PROCESSING')) then
    raise exception 'export_in_progress' using errcode = 'P0001';
  end if;

  select * into b from public.business_profiles where id = c.business_id;
  select * into loc from public.business_locations
    where business_id = c.business_id order by created_at limit 1;
  select * into kit from public.brand_kits where business_id = c.business_id;
  if c.product_id is not null then
    select * into p from public.products where id = c.product_id;
  end if;

  -- The same fact gate as buildAdProps: an export never leaves out a fact silently.
  if c.offer_text is not null and c.facts_confirmed_at is null then missing := array_append(missing, 'offer'); end if;
  if p.id is not null and p.price is not null and p.price_confirmed_at is null then missing := array_append(missing, 'price'); end if;
  if b.phone is not null and b.phone_confirmed_at is null then missing := array_append(missing, 'phone'); end if;
  if loc.id is not null and loc.confirmed_at is null then missing := array_append(missing, 'address'); end if;
  if cardinality(missing) > 0 then
    raise exception 'facts_not_confirmed' using errcode = 'P0001', detail = array_to_string(missing, ',');
  end if;

  -- An AI scene must be approved by the owner before it can be exported (PRD 4.3).
  if c.scene_clip_id is not null then
    select * into clip from public.ai_video_clips where id = c.scene_clip_id;
    if clip.status is distinct from 'COMPLETED' then
      raise exception 'clip_not_approved' using errcode = 'P0001';
    end if;
    select * into scene from public.ai_scene_types where id = clip.scene_type_id;
  end if;

  cost := private.render_cost(formats);
  select * into bal from public.credit_balances where workspace_id = c.workspace_id for update;
  if bal.workspace_id is null or bal.available < cost then
    raise exception 'insufficient_credits' using errcode = 'P0001',
      detail = format('needed %s, available %s', cost, coalesce(bal.available, 0));
  end if;

  snapshot := jsonb_build_object(
    'campaign', jsonb_build_object(
      'name', c.name, 'headline', c.headline, 'offer_text', c.offer_text,
      'start_date', c.start_date, 'end_date', c.end_date,
      'facts_confirmed_at', c.facts_confirmed_at, 'cta', c.cta, 'language', c.language,
      'outline_style', c.outline_style),
    'business', jsonb_build_object(
      'name', b.name, 'phone', b.phone, 'phone_confirmed_at', b.phone_confirmed_at),
    'location', case when loc.id is null then null else jsonb_build_object(
      'address', loc.address, 'city', loc.city, 'confirmed_at', loc.confirmed_at) end,
    'brandKit', case when kit.id is null then null else jsonb_build_object(
      'primary_color', kit.primary_color, 'secondary_color', kit.secondary_color,
      'accent_color', kit.accent_color, 'font_heading', kit.font_heading,
      'font_body', kit.font_body) end,
    'product', case when p.id is null then null else jsonb_build_object(
      'name', p.name, 'price', p.price, 'price_confirmed_at', p.price_confirmed_at) end,
    'assets', jsonb_build_object(
      'productImagePath', case when p.id is null then null else private.product_ad_image(p) end,
      'logoPath', kit.logo_path),
    'scene', case when clip.id is null then null else jsonb_build_object(
      'clipId', clip.id, 'sceneTypeId', clip.scene_type_id, 'style', scene.preview_style,
      'filePath', clip.file_path, 'mode', clip.mode) end,
    'qrCode', (select q.code from public.qr_links q where q.campaign_id = c.id),
    'watermark', not private.has_paid_access(c.workspace_id)
  );

  update public.credit_balances
    set available = available - cost, reserved = reserved + cost
    where workspace_id = c.workspace_id;

  insert into public.generation_jobs
    (workspace_id, campaign_id, type, template_id, formats, params, status, cost, created_by)
  values (c.workspace_id, c.id, 'render', c.style_id, formats, snapshot, 'QUEUED', cost, auth.uid())
  returning id into job;

  insert into public.credit_ledger (workspace_id, kind, amount, job_id, note)
  values (c.workspace_id, 'reserve', cost, job, 'Export ' || array_to_string(formats, ', '));
  insert into public.audit_events (workspace_id, actor_id, action, entity, entity_id)
  values (c.workspace_id, auth.uid(), 'render.requested', 'generation_job', job);
  return job;
end;
$$;

-- -------------------------------------------------------------------------------------
-- Grants and row-level security
-- -------------------------------------------------------------------------------------
revoke all on public.plans, public.credit_packs, public.subscriptions, public.payments
  from anon, authenticated;
grant select on public.plans, public.credit_packs to anon, authenticated;
grant select on public.subscriptions, public.payments to authenticated;

alter table public.plans enable row level security;
alter table public.credit_packs enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;

create policy "plans: everyone reads active" on public.plans
  for select to anon, authenticated using (active);
create policy "credit_packs: everyone reads active" on public.credit_packs
  for select to anon, authenticated using (active);
create policy "subscriptions: members read" on public.subscriptions
  for select to authenticated using ((select private.is_member(workspace_id)));
create policy "payments: members read" on public.payments
  for select to authenticated using ((select private.is_member(workspace_id)));

revoke all on function private.current_subscription(uuid) from public;
revoke all on function private.has_paid_access(uuid) from public;
revoke all on function private.owned_workspace(uuid) from public;
revoke all on function private.grant_credits(uuid, integer, uuid, text) from public;

revoke all on function public.billing_status(uuid) from public, anon;
grant execute on function public.billing_status(uuid) to authenticated;

revoke all on function public.billing_prepare_subscription(uuid, text) from public, anon, authenticated;
revoke all on function public.billing_prepare_order(uuid, text) from public, anon, authenticated;
revoke all on function public.billing_attach(uuid, text) from public, anon, authenticated;
revoke all on function public.billing_abandon(uuid) from public, anon, authenticated;
revoke all on function public.billing_prepare_cancel(uuid) from public, anon, authenticated;
revoke all on function public.billing_mark_cancel(uuid, uuid) from public, anon, authenticated;
revoke all on function public.process_razorpay_event(text, jsonb) from public, anon, authenticated;
grant execute on function public.billing_prepare_subscription(uuid, text) to service_role;
grant execute on function public.billing_prepare_order(uuid, text) to service_role;
grant execute on function public.billing_attach(uuid, text) to service_role;
grant execute on function public.billing_abandon(uuid) to service_role;
grant execute on function public.billing_prepare_cancel(uuid) to service_role;
grant execute on function public.billing_mark_cancel(uuid, uuid) to service_role;
grant execute on function public.process_razorpay_event(text, jsonb) to service_role;

-- The payment-result page waits for the webhook through Realtime.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.subscriptions, public.payments;
  end if;
end;
$$;
