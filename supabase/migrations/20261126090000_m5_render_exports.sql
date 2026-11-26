-- =====================================================================================
-- M5: credits, render jobs (queue), exported files, QR links, private renders bucket.
--
-- Money-like rules (architecture.md 4.3):
--  * Credits change ONLY inside the SECURITY DEFINER functions below, in one transaction
--    with the job they pay for. Users can read their balance and history, never write them.
--  * Reserve on export -> consume when every file is saved -> release on final failure.
--  * The job carries a SNAPSHOT of the confirmed facts taken when Export was pressed, so the
--    worker renders exactly what the owner approved even if details change mid-render.
--
-- Queue: generation_jobs is itself the queue. The worker claims the oldest QUEUED job with
-- FOR UPDATE SKIP LOCKED under a lease; a worker that dies loses its lease and the job is
-- claimed again; after max_attempts the job FAILS and its credits are released. This keeps
-- the credit reservation and the queue entry in the same transaction (no pgmq needed yet).
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- Credits
-- -------------------------------------------------------------------------------------
create table public.credit_balances (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  available integer not null default 0 check (available >= 0),
  reserved integer not null default 0 check (reserved >= 0),
  updated_at timestamptz not null default now()
);

create table public.credit_ledger (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null check (kind in ('grant', 'reserve', 'consume', 'release', 'refund', 'adjust')),
  amount integer not null check (amount > 0),
  job_id uuid,
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);
create index credit_ledger_workspace_id_idx on public.credit_ledger (workspace_id, created_at desc);

create trigger set_updated_at before update on public.credit_balances
  for each row execute function private.set_updated_at();

-- Free-plan starting credits (PRD 10: a few watermarked exports). Paid plans: M7 webhook.
create or replace function private.free_plan_credits()
returns integer
language sql
immutable
set search_path = ''
as $$ select 10 $$;

-- 1 credit per size; each size is delivered as MP4 + GIF + PNG poster.
create or replace function private.render_cost(p_formats text[])
returns integer
language sql
immutable
set search_path = ''
as $$ select coalesce(cardinality(p_formats), 0) $$;

-- Every new workspace gets a balance row and its free credits.
create or replace function private.init_workspace_credits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.credit_balances (workspace_id, available)
  values (new.id, private.free_plan_credits());
  insert into public.credit_ledger (workspace_id, kind, amount, note)
  values (new.id, 'grant', private.free_plan_credits(), 'Free plan credits');
  return new;
end;
$$;
create trigger init_workspace_credits after insert on public.workspaces
  for each row execute function private.init_workspace_credits();

-- Existing workspaces (created before M5) get the same start.
insert into public.credit_balances (workspace_id, available)
select w.id, private.free_plan_credits() from public.workspaces w
on conflict (workspace_id) do nothing;
insert into public.credit_ledger (workspace_id, kind, amount, note)
select w.id, 'grant', private.free_plan_credits(), 'Free plan credits'
from public.workspaces w
where not exists (select 1 from public.credit_ledger l where l.workspace_id = w.id);

-- -------------------------------------------------------------------------------------
-- QR links: one per campaign. The target is worked out at scan time from CONFIRMED facts
-- (qr-redirect Edge Function), so the code never goes stale and never points at an
-- unconfirmed number.
-- -------------------------------------------------------------------------------------
create table public.qr_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  campaign_id uuid not null unique references public.campaigns (id) on delete cascade,
  code text not null unique check (code ~ '^[0-9a-f]{12}$'),
  created_at timestamptz not null default now()
);
create index qr_links_workspace_id_idx on public.qr_links (workspace_id);

create table public.qr_scans (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  qr_link_id uuid not null references public.qr_links (id) on delete cascade,
  scanned_at timestamptz not null default now()
);
create index qr_scans_link_idx on public.qr_scans (qr_link_id, scanned_at desc);
create index qr_scans_workspace_id_idx on public.qr_scans (workspace_id);

create or replace function private.new_qr_code()
returns text
language sql
volatile
set search_path = ''
as $$ select substr(replace(gen_random_uuid()::text, '-', ''), 1, 12) $$;

create or replace function private.init_campaign_qr()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.qr_links (workspace_id, campaign_id, code)
  values (new.workspace_id, new.id, private.new_qr_code());
  return new;
end;
$$;
create trigger init_campaign_qr after insert on public.campaigns
  for each row execute function private.init_campaign_qr();

insert into public.qr_links (workspace_id, campaign_id, code)
select c.workspace_id, c.id, private.new_qr_code() from public.campaigns c
on conflict (campaign_id) do nothing;

-- -------------------------------------------------------------------------------------
-- Jobs
-- -------------------------------------------------------------------------------------
create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete set null,
  type text not null check (type in ('render')),
  template_id text not null check (template_id in ('outline_highlight')),
  template_version text check (char_length(template_version) <= 20),
  formats text[] not null
    check (cardinality(formats) between 1 and 4 and formats <@ array['9:16', '1:1', '4:5', '16:9']),
  -- Fact snapshot (FactSnapshot in @admitra/styles-engine) + storage paths. Confirmed facts only.
  params jsonb not null,
  status text not null default 'QUEUED'
    check (status in ('CREATED', 'QUEUED', 'PROCESSING', 'REVIEW_READY', 'COMPLETED', 'FAILED', 'CANCELLED')),
  progress real not null default 0 check (progress between 0 and 1),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  cost integer not null default 0 check (cost >= 0),
  error text check (char_length(error) <= 500),
  worker_id text,
  lease_until timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index generation_jobs_workspace_idx on public.generation_jobs (workspace_id, created_at desc);
create index generation_jobs_campaign_idx on public.generation_jobs (campaign_id, created_at desc);
create index generation_jobs_queue_idx on public.generation_jobs (created_at)
  where status in ('QUEUED', 'PROCESSING');

create trigger set_updated_at before update on public.generation_jobs
  for each row execute function private.set_updated_at();

create table public.creative_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete set null,
  job_id uuid not null references public.generation_jobs (id) on delete cascade,
  format text not null check (format in ('9:16', '1:1', '4:5', '16:9')),
  kind text not null check (kind in ('mp4', 'gif', 'png')),
  path text not null check (path like workspace_id::text || '/%' and char_length(path) <= 300),
  width integer not null,
  height integer not null,
  duration_seconds real,
  bytes bigint,
  created_at timestamptz not null default now(),
  unique (job_id, format, kind)
);
create index creative_assets_workspace_idx on public.creative_assets (workspace_id, created_at desc);

-- -------------------------------------------------------------------------------------
-- Access: members READ their own; nobody but the functions / service role writes.
-- -------------------------------------------------------------------------------------
revoke all on public.credit_balances, public.credit_ledger, public.qr_links, public.qr_scans,
  public.generation_jobs, public.creative_assets from anon, authenticated;
grant select on public.credit_balances, public.credit_ledger, public.qr_links, public.qr_scans,
  public.generation_jobs, public.creative_assets to authenticated;

alter table public.credit_balances enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.qr_links enable row level security;
alter table public.qr_scans enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.creative_assets enable row level security;

create policy "credit_balances: members read" on public.credit_balances
  for select to authenticated using ((select private.is_member(workspace_id)));
create policy "credit_ledger: members read" on public.credit_ledger
  for select to authenticated using ((select private.is_member(workspace_id)));
create policy "qr_links: members read" on public.qr_links
  for select to authenticated using ((select private.is_member(workspace_id)));
create policy "qr_scans: members read" on public.qr_scans
  for select to authenticated using ((select private.is_member(workspace_id)));
create policy "generation_jobs: members read" on public.generation_jobs
  for select to authenticated using ((select private.is_member(workspace_id)));
create policy "creative_assets: members read" on public.creative_assets
  for select to authenticated using ((select private.is_member(workspace_id)));

-- Live progress in the Studio (Realtime respects RLS). Only job rows are published.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.generation_jobs;
  end if;
end;
$$;

-- -------------------------------------------------------------------------------------
-- Export: check facts, snapshot them, reserve credits, queue the job. One transaction.
-- Errors carry a stable code in MESSAGE for the app: facts_not_confirmed (DETAIL lists
-- them), insufficient_credits, export_in_progress, rate_limited, invalid_formats.
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
      'productImagePath', case when p.id is null then null
        when p.cutout_status = 'ready' and p.cutout_path is not null then p.cutout_path
        else p.image_path end,
      'logoPath', kit.logo_path),
    'qrCode', (select q.code from public.qr_links q where q.campaign_id = c.id),
    'watermark', true -- free plan until billing (M7)
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
revoke all on function public.create_render_job(uuid, text[]) from public, anon;
grant execute on function public.create_render_job(uuid, text[]) to authenticated;

-- -------------------------------------------------------------------------------------
-- Worker side (service role only)
-- -------------------------------------------------------------------------------------

-- Returns reserved credits to the balance (final failure / cancel). Idempotent per job.
create or replace function private.release_job_credits(p_job uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.generation_jobs%rowtype;
begin
  select * into j from public.generation_jobs where id = p_job;
  if j.cost = 0 or exists (select 1 from public.credit_ledger l
      where l.job_id = p_job and l.kind in ('release', 'consume')) then
    return;
  end if;
  update public.credit_balances
    set available = available + j.cost, reserved = reserved - j.cost
    where workspace_id = j.workspace_id;
  insert into public.credit_ledger (workspace_id, kind, amount, job_id, note)
  values (j.workspace_id, 'release', j.cost, j.id, 'Export failed: credits returned');
end;
$$;

-- Claims the oldest runnable job (QUEUED, or PROCESSING with an expired lease).
-- Jobs that already used every attempt are failed (credits released) instead.
create or replace function public.claim_render_job(p_worker text, p_lease_seconds integer default 900)
returns setof public.generation_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.generation_jobs%rowtype;
begin
  loop
    select * into j from public.generation_jobs
      where type = 'render'
        and (status = 'QUEUED' or (status = 'PROCESSING' and lease_until < now()))
      order by created_at
      limit 1
      for update skip locked;
    if not found then
      return;
    end if;
    if j.attempts >= j.max_attempts then
      update public.generation_jobs
        set status = 'FAILED', finished_at = now(), lease_until = null,
            error = coalesce(error, 'The export stopped responding')
        where id = j.id;
      perform private.release_job_credits(j.id);
      continue;
    end if;
    update public.generation_jobs
      set status = 'PROCESSING', attempts = attempts + 1, worker_id = p_worker,
          lease_until = now() + make_interval(secs => p_lease_seconds),
          started_at = coalesce(started_at, now()), progress = 0
      where id = j.id
      returning * into j;
    return next j;
    return;
  end loop;
end;
$$;

-- Progress + lease extension. False = this worker no longer owns the job (stop work).
create or replace function public.heartbeat_render_job(
  p_job uuid, p_worker text, p_progress real, p_lease_seconds integer default 900)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.generation_jobs
    set progress = least(1, greatest(0, p_progress)),
        lease_until = now() + make_interval(secs => p_lease_seconds)
    where id = p_job and worker_id = p_worker and status = 'PROCESSING';
  return found;
end;
$$;

-- All files saved: COMPLETED and the reserved credits are spent. Idempotent.
create or replace function public.complete_render_job(p_job uuid, p_worker text, p_template_version text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.generation_jobs%rowtype;
begin
  select * into j from public.generation_jobs where id = p_job for update;
  if j.status = 'COMPLETED' then
    return true;
  end if;
  if j.status <> 'PROCESSING' or j.worker_id is distinct from p_worker then
    return false;
  end if;
  update public.generation_jobs
    set status = 'COMPLETED', progress = 1, finished_at = now(), lease_until = null,
        error = null, template_version = p_template_version
    where id = p_job;
  if j.cost > 0 and not exists (select 1 from public.credit_ledger l
      where l.job_id = p_job and l.kind in ('consume', 'release')) then
    update public.credit_balances set reserved = reserved - j.cost
      where workspace_id = j.workspace_id;
    insert into public.credit_ledger (workspace_id, kind, amount, job_id, note)
    values (j.workspace_id, 'consume', j.cost, j.id, 'Export completed');
  end if;
  return true;
end;
$$;

-- A failed attempt: back to the queue while attempts remain (p_retry), else FAILED + refund.
create or replace function public.fail_render_job(p_job uuid, p_worker text, p_error text, p_retry boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.generation_jobs%rowtype;
begin
  select * into j from public.generation_jobs where id = p_job for update;
  if j.status <> 'PROCESSING' or j.worker_id is distinct from p_worker then
    return j.status;
  end if;
  if p_retry and j.attempts < j.max_attempts then
    update public.generation_jobs
      set status = 'QUEUED', lease_until = null, worker_id = null, progress = 0,
          error = left(p_error, 500)
      where id = p_job;
    return 'QUEUED';
  end if;
  update public.generation_jobs
    set status = 'FAILED', finished_at = now(), lease_until = null, error = left(p_error, 500)
    where id = p_job;
  perform private.release_job_credits(p_job);
  return 'FAILED';
end;
$$;

revoke all on function private.free_plan_credits() from public;
revoke all on function private.render_cost(text[]) from public;
revoke all on function private.init_workspace_credits() from public;
revoke all on function private.new_qr_code() from public;
revoke all on function private.init_campaign_qr() from public;
revoke all on function private.release_job_credits(uuid) from public;
revoke all on function public.claim_render_job(text, integer) from public, anon, authenticated;
revoke all on function public.heartbeat_render_job(uuid, text, real, integer) from public, anon, authenticated;
revoke all on function public.complete_render_job(uuid, text, text) from public, anon, authenticated;
revoke all on function public.fail_render_job(uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.claim_render_job(text, integer) to service_role;
grant execute on function public.heartbeat_render_job(uuid, text, real, integer) to service_role;
grant execute on function public.complete_render_job(uuid, text, text) to service_role;
grant execute on function public.fail_render_job(uuid, text, text, boolean) to service_role;

-- -------------------------------------------------------------------------------------
-- Storage: private renders bucket, "{workspace_id}/{job_id}/..." paths.
-- Written only by the worker (service role); members read their own.
-- -------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('renders', 'renders', false, 52428800, array['video/mp4', 'image/gif', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "renders: members read" on storage.objects
  for select to authenticated
  using (bucket_id = 'renders'
         and (select private.is_member(private.try_uuid((storage.foldername(name))[1]))));
-- No insert / update / delete policy for users.
