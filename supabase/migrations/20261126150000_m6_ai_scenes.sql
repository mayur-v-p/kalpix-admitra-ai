-- =====================================================================================
-- M6: AI video scenes (PRD 4.3, FR-38) and the AI-enhanced product image (PRD 4.1).
--
--  * Owners pick a SCENE TYPE; the system writes the prompt (never prices, text or logos).
--  * Composite mode (default): the AI clip is only the background; the real product cutout
--    is layered on top by code, so the product cannot be distorted.
--  * Clips are cached by (source image, scene, prompt version, model, ratio, mode) and reused
--    for free. Credits are reserved on start, spent when the clip is ready for review,
--    returned if generation fails. The first regeneration of a rejected clip is free.
--  * The owner approves every clip; an export with an unapproved clip is refused.
--  * Provider results arrive through a signed webhook, de-duplicated by event id.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- Scene types (platform data, readable by everyone, edited only by platform admins)
-- -------------------------------------------------------------------------------------
create table public.ai_scene_types (
  id text primary key check (id ~ '^[a-z_]{3,40}$'),
  name text not null check (char_length(name) <= 60),
  description text not null check (char_length(description) <= 200),
  industries text[] not null
    check (cardinality(industries) >= 1 and industries <@ array['food', 'retail', 'beauty', 'other']),
  -- {product} is replaced by the product name. Never mention prices, text or logos.
  prompt_template text not null check (char_length(prompt_template) <= 1000),
  prompt_version integer not null default 1,
  default_mode text not null default 'composite' check (default_mode in ('composite', 'animated_product')),
  credit_cost integer not null default 2 check (credit_cost >= 0),
  -- Look of the code-drawn stand-in used by the test-mode provider (and as the still preview).
  preview_style text not null check (preview_style in ('steam', 'festive', 'sunrise', 'spa', 'studio')),
  sort integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.ai_scene_types
  (id, name, description, industries, prompt_template, preview_style, sort) values
  ('steam_closeup', 'Rising steam', 'A warm close-up with soft steam drifting up.', array['food'],
   'Slow cinematic close-up background for {product}: soft steam rising, warm morning light, shallow depth of field. No text, no numbers, no logos, no people.',
   'steam', 10),
  ('festive_lights', 'Festive lights', 'Golden fairy lights twinkling behind your product.', array['food', 'retail', 'beauty', 'other'],
   'Festive Indian celebration background for {product}: soft golden bokeh fairy lights slowly twinkling, warm glow. No text, no numbers, no logos, no people.',
   'festive', 20),
  ('sunrise_glow', 'Morning glow', 'Fresh sunrise light sweeping across the scene.', array['food', 'retail', 'beauty', 'other'],
   'Calm background for {product}: gentle sunrise light sweeping slowly across a clean surface, airy and fresh. No text, no numbers, no logos, no people.',
   'sunrise', 30),
  ('spa_calm', 'Calm spa', 'Soft, slow light and floating glow for a relaxing feel.', array['beauty'],
   'Relaxing spa background for {product}: soft diffused light, slow floating glow, calm pastel tones. No text, no numbers, no logos, no people.',
   'spa', 40),
  ('studio_spotlight', 'Studio spotlight', 'A clean studio with a slow spotlight sweep.', array['retail', 'beauty', 'other'],
   'Premium studio background for {product}: clean backdrop, slow spotlight sweep, subtle reflections. No text, no numbers, no logos, no people.',
   'studio', 50);

-- -------------------------------------------------------------------------------------
-- AI video clips
-- -------------------------------------------------------------------------------------
create table public.ai_video_clips (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  scene_type_id text not null references public.ai_scene_types (id),
  source_image_path text not null check (char_length(source_image_path) <= 300),
  provider text not null check (char_length(provider) <= 40),
  model text not null check (char_length(model) <= 80),
  prompt_version integer not null,
  aspect_ratio text not null default '9:16' check (aspect_ratio in ('9:16', '16:9')),
  mode text not null default 'composite' check (mode in ('composite', 'animated_product')),
  provider_job_id text check (char_length(provider_job_id) <= 200),
  status text not null default 'QUEUED'
    check (status in ('QUEUED', 'PROCESSING', 'REVIEW_READY', 'COMPLETED', 'FAILED', 'CANCELLED')),
  -- null file_path = the provider returned a code-drawn stand-in (test mode)
  file_path text check (file_path is null or (file_path like workspace_id::text || '/%' and char_length(file_path) <= 300)),
  poster_path text check (poster_path is null or (poster_path like workspace_id::text || '/%' and char_length(poster_path) <= 300)),
  duration_seconds real,
  cost integer not null default 0 check (cost >= 0),
  free_regeneration boolean not null default false,
  cache_key text not null check (char_length(cache_key) = 32),
  error text check (char_length(error) <= 300),
  approved_at timestamptz,
  approved_by uuid references auth.users (id) on delete set null,
  rejected_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_video_clips_workspace_idx on public.ai_video_clips (workspace_id, created_at desc);
create index ai_video_clips_cache_idx on public.ai_video_clips (cache_key, created_at desc);
-- At most one usable clip per cache key: the cache.
create unique index ai_video_clips_cache_live_idx on public.ai_video_clips (cache_key)
  where status in ('QUEUED', 'PROCESSING', 'REVIEW_READY', 'COMPLETED');
create unique index ai_video_clips_provider_job_idx on public.ai_video_clips (provider, provider_job_id)
  where provider_job_id is not null;

create trigger set_updated_at before update on public.ai_video_clips
  for each row execute function private.set_updated_at();

-- Provider webhooks: each event is processed once (unique event id).
create table public.webhook_events (
  id bigint generated always as identity primary key,
  source text not null check (source in ('razorpay', 'ai_video')),
  event_id text not null check (char_length(event_id) <= 200),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (source, event_id)
);

-- -------------------------------------------------------------------------------------
-- Campaign scene + AI-enhanced product image
-- -------------------------------------------------------------------------------------
alter table public.campaigns
  add column scene_clip_id uuid references public.ai_video_clips (id) on delete set null;
grant update (scene_clip_id) on public.campaigns to authenticated;

-- The chosen clip must belong to the same workspace and still be usable.
create or replace function private.check_campaign_scene()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.scene_clip_id is not null and not exists (
    select 1 from public.ai_video_clips v
    where v.id = new.scene_clip_id and v.workspace_id = new.workspace_id
      and v.status not in ('FAILED', 'CANCELLED')
  ) then
    raise exception 'Scene does not belong to this workspace' using errcode = '23503';
  end if;
  return new;
end;
$$;
create trigger check_campaign_scene before insert or update of scene_clip_id on public.campaigns
  for each row execute function private.check_campaign_scene();

alter table public.products
  add column enhanced_path text check (char_length(enhanced_path) <= 300),
  add column enhanced_status text not null default 'none'
    check (enhanced_status in ('none', 'processing', 'ready', 'failed')),
  add column enhanced_provider text check (char_length(enhanced_provider) <= 40),
  add column use_enhanced boolean not null default false,
  add constraint products_enhanced_path_in_workspace
    check (enhanced_path is null or enhanced_path like workspace_id::text || '/%');
-- (No new grants: users change these only through enhance-product-image / choose_product_image.)

-- A new photo makes the old enhanced version meaningless.
create or replace function private.reset_product_enhancement()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.image_path is distinct from old.image_path then
    new.enhanced_path := null;
    new.enhanced_status := 'none';
    new.enhanced_provider := null;
    new.use_enhanced := false;
  end if;
  return new;
end;
$$;
create trigger reset_product_enhancement before update on public.products
  for each row execute function private.reset_product_enhancement();

-- The image ads use for a product: the enhanced one if the owner chose it, else the cutout,
-- else the original photo.
create or replace function private.product_ad_image(p public.products)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p.use_enhanced and p.enhanced_status = 'ready' and p.enhanced_path is not null then p.enhanced_path
    when p.cutout_status = 'ready' and p.cutout_path is not null then p.cutout_path
    else p.image_path
  end
$$;

-- Owner picks the enhanced image or keeps the original.
create or replace function public.choose_product_image(p_product_id uuid, p_use_enhanced boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.products%rowtype;
begin
  select * into p from public.products where id = p_product_id;
  if p.id is null or not private.is_member(p.workspace_id) then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;
  if p_use_enhanced and (p.enhanced_status <> 'ready' or p.enhanced_path is null) then
    raise exception 'enhanced_not_ready' using errcode = 'P0001';
  end if;
  update public.products set use_enhanced = p_use_enhanced where id = p_product_id;
  insert into public.audit_events (workspace_id, actor_id, action, entity, entity_id)
  values (p.workspace_id, auth.uid(),
          case when p_use_enhanced then 'product.enhanced_chosen' else 'product.original_chosen' end,
          'product', p_product_id);
  return p_use_enhanced;
end;
$$;

-- -------------------------------------------------------------------------------------
-- Access
-- -------------------------------------------------------------------------------------
revoke all on public.ai_scene_types, public.ai_video_clips, public.webhook_events from anon, authenticated;
grant select on public.ai_scene_types to anon, authenticated;
grant select on public.ai_video_clips to authenticated;

alter table public.ai_scene_types enable row level security;
alter table public.ai_video_clips enable row level security;
alter table public.webhook_events enable row level security;

create policy "ai_scene_types: visitors read active" on public.ai_scene_types
  for select to anon using (active);
create policy "ai_scene_types: users read active, admins all" on public.ai_scene_types
  for select to authenticated using (active or (select private.is_platform_admin()));
create policy "ai_video_clips: members read" on public.ai_video_clips
  for select to authenticated using ((select private.is_member(workspace_id)));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.ai_video_clips;
  end if;
end;
$$;

-- -------------------------------------------------------------------------------------
-- Clip lifecycle (service role: the start-ai-video and ai-video-webhook Edge Functions)
-- -------------------------------------------------------------------------------------

-- Returns the cached clip, or reserves credits and creates a QUEUED clip.
-- The caller (start-ai-video) has already proved membership by reading the product as the user.
create or replace function public.reserve_ai_clip(
  p_user uuid, p_product_id uuid, p_scene_type_id text, p_mode text,
  p_provider text, p_model text)
returns table (clip_id uuid, cached boolean, clip_status text, prompt_template text, product_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.products%rowtype;
  s public.ai_scene_types%rowtype;
  industry text;
  src text;
  ckey text;
  hit public.ai_video_clips%rowtype;
  prev public.ai_video_clips%rowtype;
  cost integer;
  is_free boolean := false;
  bal public.credit_balances%rowtype;
  new_id uuid;
begin
  select * into p from public.products where id = p_product_id;
  if p.id is null or not exists (select 1 from public.workspace_members m
      where m.workspace_id = p.workspace_id and m.user_id = p_user) then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;
  src := private.product_ad_image(p);
  if src is null then
    raise exception 'no_image' using errcode = 'P0001';
  end if;
  select * into s from public.ai_scene_types where id = p_scene_type_id and active;
  select b.industry into industry from public.business_profiles b where b.id = p.business_id;
  if s.id is null or not (industry = any (s.industries)) then
    raise exception 'invalid_scene' using errcode = '22023';
  end if;
  if p_mode not in ('composite', 'animated_product') then
    raise exception 'invalid_mode' using errcode = '22023';
  end if;

  ckey := md5(concat_ws('|', src, s.id, s.prompt_version, p_provider, p_model, '9:16', p_mode));

  -- The cache: an existing usable clip is reused at no cost.
  select * into hit from public.ai_video_clips v
    where v.cache_key = ckey and v.status in ('QUEUED', 'PROCESSING', 'REVIEW_READY', 'COMPLETED');
  if hit.id is not null then
    return query select hit.id, true, hit.status, s.prompt_template, p.name;
    return;
  end if;

  if not public.consume_rate_limit('clip:' || p.workspace_id, 20, 3600) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  -- First regeneration after a rejection is free.
  select * into prev from public.ai_video_clips v
    where v.cache_key = ckey order by v.created_at desc limit 1;
  if prev.id is not null and prev.status = 'CANCELLED' and prev.rejected_at is not null
     and not prev.free_regeneration then
    is_free := true;
  end if;
  cost := case when is_free then 0 else s.credit_cost end;

  select * into bal from public.credit_balances where workspace_id = p.workspace_id for update;
  if bal.workspace_id is null or bal.available < cost then
    raise exception 'insufficient_credits' using errcode = 'P0001',
      detail = format('needed %s, available %s', cost, coalesce(bal.available, 0));
  end if;
  update public.credit_balances
    set available = available - cost, reserved = reserved + cost
    where workspace_id = p.workspace_id;

  insert into public.ai_video_clips
    (workspace_id, product_id, scene_type_id, source_image_path, provider, model, prompt_version,
     mode, status, cost, free_regeneration, cache_key, created_by)
  values (p.workspace_id, p.id, s.id, src, p_provider, p_model, s.prompt_version,
          p_mode, 'QUEUED', cost, is_free, ckey, p_user)
  returning id into new_id;

  if cost > 0 then
    insert into public.credit_ledger (workspace_id, kind, amount, job_id, note)
    values (p.workspace_id, 'reserve', cost, new_id, 'AI scene: ' || s.name);
  end if;
  insert into public.audit_events (workspace_id, actor_id, action, entity, entity_id)
  values (p.workspace_id, p_user, 'ai_clip.requested', 'ai_video_clip', new_id);

  return query select new_id, false, 'QUEUED'::text, s.prompt_template, p.name;
end;
$$;

create or replace function public.mark_ai_clip_submitted(p_clip uuid, p_provider_job_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.ai_video_clips
    set status = 'PROCESSING', provider_job_id = p_provider_job_id
    where id = p_clip and status = 'QUEUED';
  return found;
end;
$$;

-- Returns reserved clip credits to the balance once (failure).
create or replace function private.release_clip_credits(p_clip uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.ai_video_clips%rowtype;
begin
  select * into v from public.ai_video_clips where id = p_clip;
  if v.cost = 0 or exists (select 1 from public.credit_ledger l
      where l.job_id = p_clip and l.kind in ('release', 'consume')) then
    return;
  end if;
  update public.credit_balances
    set available = available + v.cost, reserved = reserved - v.cost
    where workspace_id = v.workspace_id;
  insert into public.credit_ledger (workspace_id, kind, amount, job_id, note)
  values (v.workspace_id, 'release', v.cost, v.id, 'AI scene failed: credits returned');
end;
$$;

-- The provider finished: ready for the owner's review; the credits are spent (the provider
-- has charged us). Idempotent.
create or replace function public.ai_clip_ready(
  p_clip uuid, p_file_path text, p_poster_path text, p_duration real)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.ai_video_clips%rowtype;
begin
  select * into v from public.ai_video_clips where id = p_clip for update;
  if v.id is null or v.status not in ('QUEUED', 'PROCESSING') then
    return v.status in ('REVIEW_READY', 'COMPLETED');
  end if;
  update public.ai_video_clips
    set status = 'REVIEW_READY', file_path = p_file_path, poster_path = p_poster_path,
        duration_seconds = p_duration, error = null
    where id = p_clip;
  if v.cost > 0 and not exists (select 1 from public.credit_ledger l
      where l.job_id = p_clip and l.kind in ('consume', 'release')) then
    update public.credit_balances set reserved = reserved - v.cost
      where workspace_id = v.workspace_id;
    insert into public.credit_ledger (workspace_id, kind, amount, job_id, note)
    values (v.workspace_id, 'consume', v.cost, v.id, 'AI scene generated');
  end if;
  return true;
end;
$$;

create or replace function public.fail_ai_clip(p_clip uuid, p_error text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.ai_video_clips
    set status = 'FAILED', error = left(p_error, 300)
    where id = p_clip and status in ('QUEUED', 'PROCESSING');
  if not found then
    return false;
  end if;
  perform private.release_clip_credits(p_clip);
  return true;
end;
$$;

-- -------------------------------------------------------------------------------------
-- Owner review (authenticated)
-- -------------------------------------------------------------------------------------
create or replace function public.review_ai_clip(p_clip uuid, p_approve boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.ai_video_clips%rowtype;
  next_status text := case when p_approve then 'COMPLETED' else 'CANCELLED' end;
begin
  select * into v from public.ai_video_clips where id = p_clip for update;
  if v.id is null or not private.is_member(v.workspace_id) then
    raise exception 'Clip not found' using errcode = 'P0002';
  end if;
  if v.status <> 'REVIEW_READY' then
    raise exception 'clip_not_ready' using errcode = 'P0001';
  end if;
  update public.ai_video_clips
    set status = next_status,
        approved_at = case when p_approve then now() end,
        approved_by = case when p_approve then auth.uid() end,
        rejected_at = case when p_approve then null else now() end
    where id = p_clip;
  -- A rejected clip leaves every campaign that used it.
  if not p_approve then
    update public.campaigns set scene_clip_id = null where scene_clip_id = p_clip;
  end if;
  insert into public.audit_events (workspace_id, actor_id, action, entity, entity_id)
  values (v.workspace_id, auth.uid(),
          case when p_approve then 'ai_clip.approved' else 'ai_clip.rejected' end,
          'ai_video_clip', p_clip);
  return next_status;
end;
$$;

-- -------------------------------------------------------------------------------------
-- Export: same as M5, plus the AI scene (must be approved) and the enhanced image.
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

revoke all on function private.check_campaign_scene() from public;
revoke all on function private.reset_product_enhancement() from public;
revoke all on function private.product_ad_image(public.products) from public;
revoke all on function private.release_clip_credits(uuid) from public;
revoke all on function public.choose_product_image(uuid, boolean) from public, anon;
revoke all on function public.review_ai_clip(uuid, boolean) from public, anon;
grant execute on function public.choose_product_image(uuid, boolean) to authenticated;
grant execute on function public.review_ai_clip(uuid, boolean) to authenticated;
revoke all on function public.reserve_ai_clip(uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.mark_ai_clip_submitted(uuid, text) from public, anon, authenticated;
revoke all on function public.ai_clip_ready(uuid, text, text, real) from public, anon, authenticated;
revoke all on function public.fail_ai_clip(uuid, text) from public, anon, authenticated;
grant execute on function public.reserve_ai_clip(uuid, uuid, text, text, text, text) to service_role;
grant execute on function public.mark_ai_clip_submitted(uuid, text) to service_role;
grant execute on function public.ai_clip_ready(uuid, text, text, real) to service_role;
grant execute on function public.fail_ai_clip(uuid, text) to service_role;

-- -------------------------------------------------------------------------------------
-- Storage: private ai-clips bucket (normalised provider clips + poster frames).
-- -------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ai-clips', 'ai-clips', false, 52428800, array['video/mp4', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "ai-clips: members read" on storage.objects
  for select to authenticated
  using (bucket_id = 'ai-clips'
         and (select private.is_member(private.try_uuid((storage.foldername(name))[1]))));
