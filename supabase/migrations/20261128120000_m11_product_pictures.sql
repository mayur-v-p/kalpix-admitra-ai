-- M11: product pictures. No more cut-outs: ads use the owner's whole photo, enhanced by AI,
-- plus AI pictures of the product (new scenes with the same product, or pictures made from the
-- product's name when there is no photo).
--  * AI pictures are made only by the make-product-pictures Edge Function (service role).
--  * Members may tick or untick a picture for ads, and delete it; nothing else.
--  * At most 12 pictures per product.
--  * Exports use the picture the chosen design names, only if it belongs to the ad's product
--    and is ticked; a picture made from words only adds "Image for representation only".
-- Same baseline: RLS per operation, column-level grants, SECURITY DEFINER with search_path ''.

-- 1. The image ads use: the enhanced photo if chosen, else the original (cut-outs retired).
create or replace function private.product_ad_image(p public.products)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p.use_enhanced and p.enhanced_status = 'ready' and p.enhanced_path is not null then p.enhanced_path
    else p.image_path
  end
$$;

-- 2. AI pictures of a product.
alter table public.products add constraint products_id_workspace_key unique (id, workspace_id);

create table public.product_pictures (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  product_id uuid not null,
  path text not null check (char_length(path) <= 300),
  -- scene: the owner's own product photo placed in a new setting.
  -- generated: made from the product's name (and description) only.
  kind text not null check (kind in ('scene', 'generated')),
  label text check (char_length(label) between 1 and 60),
  use_in_ads boolean not null default true,
  provider text check (char_length(provider) <= 40),
  created_at timestamptz not null default now(),
  foreign key (product_id, workspace_id)
    references public.products (id, workspace_id) on delete cascade,
  check (path like workspace_id::text || '/pictures/%')
);
create index product_pictures_product on public.product_pictures (product_id, created_at);

create or replace function private.limit_product_pictures()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.product_pictures where product_id = new.product_id) >= 12 then
    raise exception 'picture_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function private.limit_product_pictures() from public;
create trigger limit_product_pictures before insert on public.product_pictures
  for each row execute function private.limit_product_pictures();

revoke all on public.product_pictures from anon, authenticated;
grant select, delete on public.product_pictures to authenticated;
grant update (use_in_ads) on public.product_pictures to authenticated;

alter table public.product_pictures enable row level security;
create policy "product_pictures: members read" on public.product_pictures
  for select to authenticated using ((select private.is_member(workspace_id)));
create policy "product_pictures: members update" on public.product_pictures
  for update to authenticated
  using ((select private.is_member(workspace_id)))
  with check ((select private.is_member(workspace_id)));
create policy "product_pictures: members delete" on public.product_pictures
  for delete to authenticated using ((select private.is_member(workspace_id)));
-- No insert policy: only the Edge Function (service role) adds pictures.

-- 3. Exports: same as M10, plus the design's picture and the representation note.
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
  pic public.product_pictures%rowtype;
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

  -- The picture the chosen design uses (a ticked AI picture of this product), if any.
  if p.id is not null and c.design is not null
     and coalesce(c.design->>'picture', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select * into pic from public.product_pictures
      where id = (c.design->>'picture')::uuid and product_id = p.id and use_in_ads;
  end if;
  -- A product without a photo: its newest ticked AI picture.
  if pic.id is null and p.id is not null and p.image_path is null then
    select * into pic from public.product_pictures
      where product_id = p.id and use_in_ads order by created_at desc limit 1;
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
      'productImagePath', case when pic.id is not null then pic.path when p.id is null then (
          select bp.path from public.business_photos bp
          where bp.business_id = c.business_id
          order by bp.is_main desc, bp.created_at limit 1)
        else private.product_ad_image(p) end,
      'logoPath', kit.logo_path,
      -- A picture made from words only is not a photo of the real product: say so on the ad.
      'imageNote', case when pic.kind = 'generated' then 'Image for representation only' end),
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
