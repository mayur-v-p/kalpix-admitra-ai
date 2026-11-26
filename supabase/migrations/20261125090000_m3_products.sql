-- =====================================================================================
-- M3: product library, owner-confirmed facts, product-images bucket, rate limits.
-- Same security baseline as M2: workspace_id on every row, one RLS policy per operation,
-- column-level grants, helpers with search_path = ''.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- Who confirmed a fact (M2 already stores *when*).
-- -------------------------------------------------------------------------------------
alter table public.business_profiles
  add column phone_confirmed_by uuid references auth.users (id) on delete set null;
alter table public.business_locations
  add column confirmed_by uuid references auth.users (id) on delete set null;

-- The M2 reset triggers also clear the new *_by columns.
create or replace function private.reset_phone_confirmation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.phone is distinct from old.phone then
    new.phone_confirmed_at := null;
    new.phone_confirmed_by := null;
  end if;
  return new;
end;
$$;

create or replace function private.reset_location_confirmation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.address is distinct from old.address
     or new.city is distinct from old.city
     or new.map_url is distinct from old.map_url then
    new.confirmed_at := null;
    new.confirmed_by := null;
  end if;
  return new;
end;
$$;

-- -------------------------------------------------------------------------------------
-- Products
-- -------------------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  business_id uuid not null,
  name text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 1000),
  price numeric(10, 2) check (price >= 0 and price <= 10000000),
  currency text not null default 'INR' check (currency = 'INR'),
  price_confirmed_at timestamptz,
  price_confirmed_by uuid references auth.users (id) on delete set null,
  image_path text check (char_length(image_path) <= 300),
  cutout_path text check (char_length(cutout_path) <= 300),
  cutout_status text not null default 'none'
    check (cutout_status in ('none', 'pending', 'processing', 'ready', 'failed')),
  cutout_provider text check (char_length(cutout_provider) <= 40),
  cutout_error text check (char_length(cutout_error) <= 300),
  outline_svg text,
  outline_status text not null default 'pending'
    check (outline_status in ('pending', 'processing', 'ready', 'failed')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (business_id, workspace_id)
    references public.business_profiles (id, workspace_id) on delete cascade,
  -- an image path must live inside the workspace's own folder
  check (image_path is null or image_path like workspace_id::text || '/%'),
  check (cutout_path is null or cutout_path like workspace_id::text || '/%')
);
create index products_workspace_id_idx on public.products (workspace_id) where archived_at is null;

create trigger set_updated_at before update on public.products
  for each row execute function private.set_updated_at();

-- A changed price is no longer confirmed; a new photo needs a new cutout and outline.
create or replace function private.reset_product_facts()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.price is distinct from old.price then
    new.price_confirmed_at := null;
    new.price_confirmed_by := null;
  end if;
  if new.image_path is distinct from old.image_path then
    new.cutout_path := null;
    new.cutout_status := case when new.image_path is null then 'none' else 'pending' end;
    new.cutout_provider := null;
    new.cutout_error := null;
    new.outline_svg := null;
    new.outline_status := 'pending';
  end if;
  return new;
end;
$$;
create trigger reset_product_facts before update on public.products
  for each row execute function private.reset_product_facts();

-- New products with a photo start with a pending cutout.
create or replace function private.init_product()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.cutout_status := case when new.image_path is null then 'none' else 'pending' end;
  return new;
end;
$$;
create trigger init_product before insert on public.products
  for each row execute function private.init_product();

revoke all on function private.reset_product_facts() from public;
revoke all on function private.init_product() from public;

-- Grants: members may set only these columns. Cutout fields, confirmations and the
-- outline are written by Edge Functions / the media worker / the confirm functions.
revoke all on public.products from anon, authenticated;
grant select, delete on public.products to authenticated;
grant insert (workspace_id, business_id, name, description, price, image_path)
  on public.products to authenticated;
grant update (name, description, price, image_path, archived_at)
  on public.products to authenticated;

alter table public.products enable row level security;
create policy "products: members read" on public.products
  for select to authenticated using ((select private.is_member(workspace_id)));
create policy "products: members insert" on public.products
  for insert to authenticated with check ((select private.is_member(workspace_id)));
create policy "products: members update" on public.products
  for update to authenticated
  using ((select private.is_member(workspace_id)))
  with check ((select private.is_member(workspace_id)));
create policy "products: members delete" on public.products
  for delete to authenticated using ((select private.is_member(workspace_id)));

-- -------------------------------------------------------------------------------------
-- Confirming facts (PRD: prices, phone numbers and addresses render only from
-- owner-confirmed fields). Callable by signed-in members of the record's workspace.
-- Each records who confirmed and when, and writes an audit event.
-- -------------------------------------------------------------------------------------
create or replace function public.confirm_product_price(p_product_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid;
  current_price numeric;
  confirmed timestamptz := now();
begin
  select p.workspace_id, p.price into ws, current_price
  from public.products p where p.id = p_product_id;
  if ws is null or not private.is_member(ws) then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;
  if current_price is null then
    raise exception 'Add a price before confirming it' using errcode = '22023';
  end if;
  update public.products
    set price_confirmed_at = confirmed, price_confirmed_by = auth.uid()
    where id = p_product_id;
  insert into public.audit_events (workspace_id, actor_id, action, entity, entity_id)
  values (ws, auth.uid(), 'product.price_confirmed', 'product', p_product_id);
  return confirmed;
end;
$$;

create or replace function public.confirm_business_phone(p_business_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid;
  current_phone text;
  confirmed timestamptz := now();
begin
  select b.workspace_id, b.phone into ws, current_phone
  from public.business_profiles b where b.id = p_business_id;
  if ws is null or not private.is_member(ws) then
    raise exception 'Business not found' using errcode = 'P0002';
  end if;
  if current_phone is null then
    raise exception 'Add a phone number before confirming it' using errcode = '22023';
  end if;
  update public.business_profiles
    set phone_confirmed_at = confirmed, phone_confirmed_by = auth.uid()
    where id = p_business_id;
  insert into public.audit_events (workspace_id, actor_id, action, entity, entity_id)
  values (ws, auth.uid(), 'business.phone_confirmed', 'business_profile', p_business_id);
  return confirmed;
end;
$$;

create or replace function public.confirm_location(p_location_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid;
  confirmed timestamptz := now();
begin
  select l.workspace_id into ws from public.business_locations l where l.id = p_location_id;
  if ws is null or not private.is_member(ws) then
    raise exception 'Location not found' using errcode = 'P0002';
  end if;
  update public.business_locations
    set confirmed_at = confirmed, confirmed_by = auth.uid()
    where id = p_location_id;
  insert into public.audit_events (workspace_id, actor_id, action, entity, entity_id)
  values (ws, auth.uid(), 'location.confirmed', 'business_location', p_location_id);
  return confirmed;
end;
$$;

revoke all on function public.confirm_product_price(uuid) from public, anon;
revoke all on function public.confirm_business_phone(uuid) from public, anon;
revoke all on function public.confirm_location(uuid) from public, anon;
grant execute on function public.confirm_product_price(uuid) to authenticated;
grant execute on function public.confirm_business_phone(uuid) to authenticated;
grant execute on function public.confirm_location(uuid) to authenticated;

-- -------------------------------------------------------------------------------------
-- Rate limits for expensive server actions (AI calls). Used by Edge Functions with the
-- service role; invisible to users.
-- -------------------------------------------------------------------------------------
create table public.rate_limits (
  key text not null check (char_length(key) <= 200),
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Atomically counts one hit for `p_key` in the current window.
-- Returns true when the call is allowed, false when the limit is reached.
create or replace function public.consume_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  bucket timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  hits integer;
begin
  insert into public.rate_limits (key, window_start, count)
  values (p_key, bucket, 1)
  on conflict (key, window_start) do update set count = public.rate_limits.count + 1
  returning count into hits;
  delete from public.rate_limits where window_start < now() - interval '1 day';
  return hits <= p_max;
end;
$$;
revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

-- -------------------------------------------------------------------------------------
-- Storage: private product-images bucket, "{workspace_id}/..." paths.
-- Originals are uploaded by members; cutouts are written by the Edge Function.
-- -------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', false, 10485760,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "product-images: members read" on storage.objects
  for select to authenticated
  using (bucket_id = 'product-images'
         and (select private.is_member(private.try_uuid((storage.foldername(name))[1]))));
create policy "product-images: members upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images'
              and (select private.is_member(private.try_uuid((storage.foldername(name))[1]))));
create policy "product-images: members delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images'
         and (select private.is_member(private.try_uuid((storage.foldername(name))[1]))));
-- No update policy: originals are immutable; a new photo is a new file.
