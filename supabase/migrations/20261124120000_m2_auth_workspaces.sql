-- =====================================================================================
-- M2: accounts, workspaces, business profile, brand kit.
-- Security baseline (architecture.md "Security baseline"):
--   * RLS on every table, one policy per operation, for the `authenticated` role only.
--   * Every tenant table carries workspace_id; membership is checked by private.is_member().
--   * Column-level grants: users can only insert/update the columns listed below, so they
--     can never change workspace_id, ownership, roles or *_confirmed_at fields.
--   * Helper functions live in the `private` schema (not exposed by the Data API), are
--     SECURITY DEFINER with search_path = '' and are executable only by `authenticated`.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- Private schema for helpers
-- -------------------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- Returns null instead of raising when text is not a valid uuid (used by storage policies).
create or replace function private.try_uuid(value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return value::uuid;
exception when others then
  return null;
end;
$$;

-- Keeps updated_at current.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -------------------------------------------------------------------------------------
-- Tables
-- -------------------------------------------------------------------------------------
create type public.workspace_type as enum ('business', 'agency', 'franchise');
create type public.member_role as enum ('owner', 'member');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  phone text check (phone ~ '^\+?[0-9 ]{7,20}$'),
  language text not null default 'en' check (language in ('en', 'hi', 'mr', 'hinglish')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  type public.workspace_type not null default 'business',
  is_trial boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workspaces_owner_id_idx on public.workspaces (owner_id);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_id_idx on public.workspace_members (user_id);

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  industry text not null check (industry in ('food', 'retail', 'beauty', 'other')),
  description text check (char_length(description) <= 1000),
  phone text check (phone ~ '^\+?[0-9 ]{7,20}$'),
  phone_confirmed_at timestamptz,
  website text check (website ~* '^https?://[^\s]+$' and char_length(website) <= 300),
  languages text[] not null default array['en']
    check (cardinality(languages) between 1 and 4
           and languages <@ array['en', 'hi', 'mr', 'hinglish']),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- lets child tables prove their business belongs to the same workspace
  unique (id, workspace_id)
);

create table public.business_locations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  business_id uuid not null,
  label text check (char_length(label) <= 60),
  address text not null check (char_length(address) between 1 and 300),
  city text not null check (char_length(city) between 1 and 80),
  map_url text check (map_url ~* '^https://[^\s]+$' and char_length(map_url) <= 500),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (business_id, workspace_id)
    references public.business_profiles (id, workspace_id) on delete cascade
);
create index business_locations_workspace_id_idx on public.business_locations (workspace_id);

create table public.brand_kits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces (id) on delete cascade,
  business_id uuid not null unique,
  logo_path text check (char_length(logo_path) <= 300),
  primary_color text not null default '#1E1E1C' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text not null default '#F6F4EF' check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text not null default '#F2C94C' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  font_heading text not null default 'Jost'
    check (font_heading in ('Jost', 'Inter', 'Noto Sans Devanagari')),
  font_body text not null default 'Inter'
    check (font_body in ('Jost', 'Inter', 'Noto Sans Devanagari')),
  tone text not null default 'friendly'
    check (tone in ('friendly', 'premium', 'playful', 'professional', 'festive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (business_id, workspace_id)
    references public.business_profiles (id, workspace_id) on delete cascade
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  created_at timestamptz not null default now()
);
create index audit_events_workspace_id_idx on public.audit_events (workspace_id);

-- updated_at triggers
create trigger set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.workspaces
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.business_profiles
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.business_locations
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.brand_kits
  for each row execute function private.set_updated_at();

-- A confirmed fact stops being confirmed as soon as it changes (PRD: owner-confirmed facts).
create or replace function private.reset_phone_confirmation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.phone is distinct from old.phone then
    new.phone_confirmed_at := null;
  end if;
  return new;
end;
$$;
create trigger reset_phone_confirmation before update on public.business_profiles
  for each row execute function private.reset_phone_confirmation();

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
  end if;
  return new;
end;
$$;
create trigger reset_location_confirmation before update on public.business_locations
  for each row execute function private.reset_location_confirmation();

-- -------------------------------------------------------------------------------------
-- Authorization helpers (SECURITY DEFINER so policies can read memberships without
-- recursing into workspace_members' own RLS).
-- -------------------------------------------------------------------------------------
create or replace function private.is_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_owner(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = (select auth.uid()) and m.role = 'owner'
  );
$$;

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid()));
$$;

revoke all on function private.try_uuid(text) from public;
revoke all on function private.is_member(uuid) from public;
revoke all on function private.is_owner(uuid) from public;
revoke all on function private.is_platform_admin() from public;
revoke all on function private.set_updated_at() from public;
revoke all on function private.reset_phone_confirmation() from public;
revoke all on function private.reset_location_confirmation() from public;
grant execute on function private.try_uuid(text) to authenticated;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.is_owner(uuid) to authenticated;
grant execute on function private.is_platform_admin() to authenticated;

-- -------------------------------------------------------------------------------------
-- New user: profile + personal workspace + owner membership.
-- user metadata is user-editable, so it is used only for the display name, never for access.
-- -------------------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  display_name text := left(nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name', '')), ''), 120);
  new_workspace_id uuid;
begin
  insert into public.profiles (id, full_name) values (new.id, display_name);

  insert into public.workspaces (owner_id, name, is_trial)
  values (new.id, 'My business', coalesce(new.is_anonymous, false))
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  insert into public.audit_events (workspace_id, actor_id, action, entity, entity_id)
  values (new_workspace_id, new.id, 'workspace.created', 'workspace', new_workspace_id);

  return new;
end;
$$;
revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- -------------------------------------------------------------------------------------
-- Grants: nothing for anon; column-level insert/update for authenticated.
-- -------------------------------------------------------------------------------------
revoke all on public.profiles, public.workspaces, public.workspace_members,
  public.platform_admins, public.business_profiles, public.business_locations,
  public.brand_kits, public.audit_events from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, phone, language) on public.profiles to authenticated;

grant select on public.workspaces to authenticated;
grant update (name) on public.workspaces to authenticated;

grant select on public.workspace_members to authenticated;

grant select on public.business_profiles to authenticated;
grant insert (workspace_id, name, industry, description, phone, website, languages)
  on public.business_profiles to authenticated;
grant update (name, industry, description, phone, website, languages)
  on public.business_profiles to authenticated;

grant select, delete on public.business_locations to authenticated;
grant insert (workspace_id, business_id, label, address, city, map_url)
  on public.business_locations to authenticated;
grant update (label, address, city, map_url) on public.business_locations to authenticated;

grant select on public.brand_kits to authenticated;
grant insert (workspace_id, business_id, logo_path, primary_color, secondary_color,
  accent_color, font_heading, font_body, tone) on public.brand_kits to authenticated;
grant update (logo_path, primary_color, secondary_color, accent_color, font_heading,
  font_body, tone) on public.brand_kits to authenticated;

grant select on public.audit_events to authenticated;

-- -------------------------------------------------------------------------------------
-- Row-level security
-- -------------------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.platform_admins enable row level security;
alter table public.business_profiles enable row level security;
alter table public.business_locations enable row level security;
alter table public.brand_kits enable row level security;
alter table public.audit_events enable row level security;

-- profiles: only your own row
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- workspaces: members read, owners rename
create policy "workspaces: members read" on public.workspaces
  for select to authenticated using ((select private.is_member(id)));
create policy "workspaces: owners update" on public.workspaces
  for update to authenticated
  using ((select private.is_owner(id))) with check ((select private.is_owner(id)));

-- workspace_members: members see the member list of their workspaces (no writes in M2)
create policy "workspace_members: members read" on public.workspace_members
  for select to authenticated using ((select private.is_member(workspace_id)));

-- platform_admins: RLS on, no policies -> invisible to every user.

-- business_profiles
create policy "business_profiles: members read" on public.business_profiles
  for select to authenticated using ((select private.is_member(workspace_id)));
create policy "business_profiles: members insert" on public.business_profiles
  for insert to authenticated with check ((select private.is_member(workspace_id)));
create policy "business_profiles: members update" on public.business_profiles
  for update to authenticated
  using ((select private.is_member(workspace_id)))
  with check ((select private.is_member(workspace_id)));

-- business_locations
create policy "business_locations: members read" on public.business_locations
  for select to authenticated using ((select private.is_member(workspace_id)));
create policy "business_locations: members insert" on public.business_locations
  for insert to authenticated with check ((select private.is_member(workspace_id)));
create policy "business_locations: members update" on public.business_locations
  for update to authenticated
  using ((select private.is_member(workspace_id)))
  with check ((select private.is_member(workspace_id)));
create policy "business_locations: members delete" on public.business_locations
  for delete to authenticated using ((select private.is_member(workspace_id)));

-- brand_kits
create policy "brand_kits: members read" on public.brand_kits
  for select to authenticated using ((select private.is_member(workspace_id)));
create policy "brand_kits: members insert" on public.brand_kits
  for insert to authenticated with check ((select private.is_member(workspace_id)));
create policy "brand_kits: members update" on public.brand_kits
  for update to authenticated
  using ((select private.is_member(workspace_id)))
  with check ((select private.is_member(workspace_id)));

-- audit_events: owners read their workspace's log; only database functions write it
create policy "audit_events: owners read" on public.audit_events
  for select to authenticated using ((select private.is_owner(workspace_id)));

-- -------------------------------------------------------------------------------------
-- Storage: private brand-assets bucket. Paths are "{workspace_id}/...".
-- PNG/JPEG/WebP only (no SVG: it can carry script), 5 MB max.
-- -------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-assets', 'brand-assets', false, 5242880,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "brand-assets: members read" on storage.objects
  for select to authenticated
  using (bucket_id = 'brand-assets'
         and (select private.is_member(private.try_uuid((storage.foldername(name))[1]))));
create policy "brand-assets: members upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'brand-assets'
              and (select private.is_member(private.try_uuid((storage.foldername(name))[1]))));
create policy "brand-assets: members update" on storage.objects
  for update to authenticated
  using (bucket_id = 'brand-assets'
         and (select private.is_member(private.try_uuid((storage.foldername(name))[1]))))
  with check (bucket_id = 'brand-assets'
              and (select private.is_member(private.try_uuid((storage.foldername(name))[1]))));
create policy "brand-assets: members delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'brand-assets'
         and (select private.is_member(private.try_uuid((storage.foldername(name))[1]))));
