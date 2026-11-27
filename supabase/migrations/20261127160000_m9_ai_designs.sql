-- =====================================================================================
-- M9: AI-designed ads ("Ad Composer").
--  * Every sector, not only food/retail/beauty (healthcare, fitness, education, ...).
--  * Optional business details for ads: opening hours, specialities, "since" year and a
--    registration number (RERA for real estate, clinic registration). Hours, year and
--    registration are FACTS: shown only once confirmed, unconfirmed again when changed.
--  * Campaign purpose (promote, menu, opening, ...) and the chosen design recipe.
--  * Exports render the Composer when chosen; real-estate ads need a confirmed RERA number.
-- Same baseline: column-level grants, RLS unchanged, SECURITY DEFINER with search_path ''.
-- =====================================================================================

-- ------------------------------------------------------------------------------- sectors
alter table public.business_profiles drop constraint business_profiles_industry_check;
alter table public.business_profiles add constraint business_profiles_industry_check check (
  industry in ('food', 'retail', 'beauty', 'other', -- original types, still valid
               'cafe', 'restaurant', 'sweets', 'bakery', 'grocery', 'clothing', 'jewellery',
               'electronics', 'clinic', 'pharmacy', 'diagnostics', 'fitness', 'education',
               'real_estate', 'services'));

-- ------------------------------------------------------------------------------- business details
create or replace function private.short_items(items text[], max_len integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(char_length(i) between 1 and max_len), true) from unnest(items) as i;
$$;
revoke all on function private.short_items(text[], integer) from public;
-- Used by a CHECK constraint, so the roles that write the table must be able to run it.
grant execute on function private.short_items(text[], integer) to authenticated, service_role;

alter table public.business_profiles
  add column opening_hours text check (char_length(opening_hours) between 1 and 80),
  add column specialities text[] not null default '{}'
    check (cardinality(specialities) <= 8 and private.short_items(specialities, 22)),
  add column since_year integer check (since_year between 1800 and 2100),
  add column registration_no text check (char_length(registration_no) between 3 and 60),
  add column details_confirmed_at timestamptz,
  add column details_confirmed_by uuid references auth.users (id) on delete set null;

-- Changing hours, year or registration clears their confirmation.
create or replace function private.reset_business_details()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.opening_hours is distinct from old.opening_hours
     or new.since_year is distinct from old.since_year
     or new.registration_no is distinct from old.registration_no then
    new.details_confirmed_at := null;
    new.details_confirmed_by := null;
  end if;
  return new;
end;
$$;
revoke all on function private.reset_business_details() from public;
create trigger reset_business_details before update on public.business_profiles
  for each row execute function private.reset_business_details();

-- The owner confirms hours, year and registration exactly as entered.
create or replace function public.confirm_business_details(p_business_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid;
  confirmed timestamptz := now();
begin
  select b.workspace_id into ws from public.business_profiles b where b.id = p_business_id;
  if ws is null or not private.is_member(ws) then
    raise exception 'Business not found' using errcode = 'P0002';
  end if;
  update public.business_profiles
    set details_confirmed_at = confirmed, details_confirmed_by = auth.uid()
    where id = p_business_id;
  insert into public.audit_events (workspace_id, actor_id, action, entity, entity_id)
  values (ws, auth.uid(), 'business.details_confirmed', 'business_profile', p_business_id);
  return confirmed;
end;
$$;
revoke all on function public.confirm_business_details(uuid) from public, anon;
grant execute on function public.confirm_business_details(uuid) to authenticated;

grant insert (opening_hours, specialities, since_year, registration_no)
  on public.business_profiles to authenticated;
grant update (opening_hours, specialities, since_year, registration_no)
  on public.business_profiles to authenticated;

-- ------------------------------------------------------------------------------- campaigns
alter table public.campaigns
  add column purpose text not null default 'promote'
    check (purpose in ('promote', 'menu', 'new_arrivals', 'festival', 'opening', 'offer')),
  -- The chosen design recipe (checked again by the Composer every time it is drawn).
  add column design jsonb check (design is null or (jsonb_typeof(design) = 'object'
                                                    and pg_column_size(design) <= 16384));

alter table public.campaigns drop constraint campaigns_style_id_check;
alter table public.campaigns
  add constraint campaigns_style_id_check check (style_id in ('outline_highlight', 'composer'));

grant insert (purpose, design) on public.campaigns to authenticated;
grant update (purpose, design) on public.campaigns to authenticated;

alter table public.generation_jobs drop constraint generation_jobs_template_id_check;
alter table public.generation_jobs
  add constraint generation_jobs_template_id_check check (template_id in ('outline_highlight', 'composer'));

-- ------------------------------------------------------------------------------- exports
-- Same as M7, plus: purpose, design, sector and the confirmed details in the snapshot, and
-- the registration rule for real estate.
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
      'productImagePath', case when p.id is null then null else private.product_ad_image(p) end,
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
