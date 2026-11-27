-- =====================================================================================
-- M10: business photos (the shop, the inside, the team) for "Promote my business" ads.
--  * Stored in the private product-images bucket under "{workspace_id}/business/...", so the
--    existing storage policies (members of that workspace only) apply unchanged.
--  * One main photo per business; at most 12 photos.
--  * Exports of an ad without a product use the main business photo.
-- Same baseline: RLS per operation, column-level grants, SECURITY DEFINER with search_path ''.
-- =====================================================================================

create table public.business_photos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  business_id uuid not null,
  path text not null check (char_length(path) <= 300),
  label text check (char_length(label) between 1 and 40),
  is_main boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (business_id, workspace_id)
    references public.business_profiles (id, workspace_id) on delete cascade,
  -- The file must be in this workspace's own folder.
  check (path like workspace_id::text || '/business/%')
);
create index business_photos_business_idx on public.business_photos (business_id, created_at);
create unique index business_photos_one_main on public.business_photos (business_id) where is_main;

create or replace function private.limit_business_photos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.business_photos where business_id = new.business_id) >= 12 then
    raise exception 'photo_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function private.limit_business_photos() from public;
create trigger limit_business_photos before insert on public.business_photos
  for each row execute function private.limit_business_photos();

revoke all on public.business_photos from anon, authenticated;
grant select, delete on public.business_photos to authenticated;
grant insert (workspace_id, business_id, path, label) on public.business_photos to authenticated;
grant update (label) on public.business_photos to authenticated;

alter table public.business_photos enable row level security;
create policy "business_photos: members read" on public.business_photos
  for select to authenticated using ((select private.is_member(workspace_id)));
create policy "business_photos: members insert" on public.business_photos
  for insert to authenticated with check ((select private.is_member(workspace_id)));
create policy "business_photos: members update" on public.business_photos
  for update to authenticated
  using ((select private.is_member(workspace_id)))
  with check ((select private.is_member(workspace_id)));
create policy "business_photos: members delete" on public.business_photos
  for delete to authenticated using ((select private.is_member(workspace_id)));

-- Makes one photo the main one (the first photo becomes main automatically, see below).
create or replace function public.set_main_business_photo(p_photo_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ph public.business_photos%rowtype;
begin
  select * into ph from public.business_photos where id = p_photo_id;
  if ph.id is null or not private.is_member(ph.workspace_id) then
    raise exception 'Photo not found' using errcode = 'P0002';
  end if;
  update public.business_photos set is_main = false where business_id = ph.business_id and is_main;
  update public.business_photos set is_main = true where id = p_photo_id;
end;
$$;
revoke all on function public.set_main_business_photo(uuid) from public, anon;
grant execute on function public.set_main_business_photo(uuid) to authenticated;

create or replace function private.first_photo_is_main()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.business_photos where business_id = new.business_id and is_main) then
    update public.business_photos set is_main = true where id = new.id;
  end if;
  return null;
end;
$$;
revoke all on function private.first_photo_is_main() from public;
create trigger first_photo_is_main after insert on public.business_photos
  for each row execute function private.first_photo_is_main();

-- -------------------------------------------------------------------------------------
-- Exports: same as M9, but an ad without a product uses the main business photo.
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
  details_ok boolean;
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
  details_ok := b.details_confirmed_at is not null;

  -- The same fact gate as buildAdProps: an export never leaves out a fact silently.
  if c.offer_text is not null and c.facts_confirmed_at is null then missing := array_append(missing, 'offer'); end if;
  if p.id is not null and p.price is not null and p.price_confirmed_at is null then missing := array_append(missing, 'price'); end if;
  if b.phone is not null and b.phone_confirmed_at is null then missing := array_append(missing, 'phone'); end if;
  if loc.id is not null and loc.confirmed_at is null then missing := array_append(missing, 'address'); end if;
  if c.style_id = 'composer' then
    if (b.opening_hours is not null or b.since_year is not null or b.registration_no is not null)
       and not details_ok then
      missing := array_append(missing, 'details');
    end if;
    -- Indian law: a real-estate ad must show the project's RERA registration number.
    if b.industry = 'real_estate' and (b.registration_no is null or not details_ok) then
      missing := array_append(missing, 'registration');
    end if;
  end if;
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

  if c.style_id = 'composer' and c.design is null then
    raise exception 'design_not_chosen' using errcode = 'P0001';
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
      'outline_style', c.outline_style, 'purpose', c.purpose),
    'business', jsonb_build_object(
      'name', b.name, 'phone', b.phone, 'phone_confirmed_at', b.phone_confirmed_at,
      'industry', b.industry, 'specialities', to_jsonb(b.specialities),
      'opening_hours', case when details_ok then b.opening_hours end,
      'since_year', case when details_ok then b.since_year end,
      'registration_no', case when details_ok then b.registration_no end),
    'location', case when loc.id is null then null else jsonb_build_object(
      'address', loc.address, 'city', loc.city, 'confirmed_at', loc.confirmed_at) end,
    'brandKit', case when kit.id is null then null else jsonb_build_object(
      'primary_color', kit.primary_color, 'secondary_color', kit.secondary_color,
      'accent_color', kit.accent_color, 'font_heading', kit.font_heading,
      'font_body', kit.font_body) end,
    'product', case when p.id is null then null else jsonb_build_object(
      'name', p.name, 'price', p.price, 'price_confirmed_at', p.price_confirmed_at) end,
    'assets', jsonb_build_object(
      -- No product (e.g. "Promote my business"): the main business photo.
      'productImagePath', case when p.id is null then (
          select bp.path from public.business_photos bp
          where bp.business_id = c.business_id
          order by bp.is_main desc, bp.created_at limit 1)
        else private.product_ad_image(p) end,
      'logoPath', kit.logo_path),
    'scene', case when clip.id is null then null else jsonb_build_object(
      'clipId', clip.id, 'sceneTypeId', clip.scene_type_id, 'style', scene.preview_style,
      'filePath', clip.file_path, 'mode', clip.mode) end,
    'design', c.design,
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
revoke all on function public.create_render_job(uuid, text[]) from public, anon;
grant execute on function public.create_render_job(uuid, text[]) to authenticated;
