-- =====================================================================================
-- M4: campaigns (the brief), confirmed offer + dates, chosen style and ad copy.
-- Same baseline: workspace_id on every row, RLS per operation, column-level grants.
-- =====================================================================================

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  business_id uuid not null,
  product_id uuid references public.products (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  goal text not null default 'sale'
    check (goal in ('sale', 'new_product', 'festival', 'event', 'booking', 'visit')),
  -- Facts: shown on ads only once confirmed.
  offer_text text check (char_length(offer_text) <= 40),
  start_date date,
  end_date date,
  facts_confirmed_at timestamptz,
  facts_confirmed_by uuid references auth.users (id) on delete set null,
  cta text not null default 'whatsapp' check (cta in ('whatsapp', 'call', 'visit', 'book', 'order')),
  language text not null default 'en' check (language in ('en', 'hi', 'mr', 'hinglish')),
  -- Style
  style_id text not null default 'rope_build' check (style_id in ('rope_build')),
  rope_material text not null default 'cord' check (rope_material in ('cord', 'neon', 'gold')),
  -- Copy (AI drafts the owner picks and edits). Never contains prices or offers.
  headline text check (char_length(headline) <= 80),
  caption text check (char_length(caption) <= 600),
  hashtags text[] not null default '{}' check (cardinality(hashtags) <= 15),
  status text not null default 'draft' check (status in ('draft', 'ready')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (business_id, workspace_id)
    references public.business_profiles (id, workspace_id) on delete cascade,
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index campaigns_workspace_id_idx on public.campaigns (workspace_id, created_at desc);

create trigger set_updated_at before update on public.campaigns
  for each row execute function private.set_updated_at();

-- The chosen product must belong to the same workspace.
create or replace function private.check_campaign_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.product_id is not null and not exists (
    select 1 from public.products p where p.id = new.product_id and p.workspace_id = new.workspace_id
  ) then
    raise exception 'Product does not belong to this workspace' using errcode = '23503';
  end if;
  return new;
end;
$$;
create trigger check_campaign_product before insert or update of product_id on public.campaigns
  for each row execute function private.check_campaign_product();

-- Changing the offer or dates clears their confirmation.
create or replace function private.reset_campaign_facts()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.offer_text is distinct from old.offer_text
     or new.start_date is distinct from old.start_date
     or new.end_date is distinct from old.end_date then
    new.facts_confirmed_at := null;
    new.facts_confirmed_by := null;
  end if;
  return new;
end;
$$;
create trigger reset_campaign_facts before update on public.campaigns
  for each row execute function private.reset_campaign_facts();

revoke all on function private.check_campaign_product() from public;
revoke all on function private.reset_campaign_facts() from public;

revoke all on public.campaigns from anon, authenticated;
grant select, delete on public.campaigns to authenticated;
grant insert (workspace_id, business_id, product_id, name, goal, offer_text, start_date, end_date,
  cta, language, style_id, rope_material, headline, caption, hashtags)
  on public.campaigns to authenticated;
grant update (product_id, name, goal, offer_text, start_date, end_date, cta, language,
  style_id, rope_material, headline, caption, hashtags)
  on public.campaigns to authenticated;

alter table public.campaigns enable row level security;
create policy "campaigns: members read" on public.campaigns
  for select to authenticated using ((select private.is_member(workspace_id)));
create policy "campaigns: members insert" on public.campaigns
  for insert to authenticated with check ((select private.is_member(workspace_id)));
create policy "campaigns: members update" on public.campaigns
  for update to authenticated
  using ((select private.is_member(workspace_id)))
  with check ((select private.is_member(workspace_id)));
create policy "campaigns: members delete" on public.campaigns
  for delete to authenticated using ((select private.is_member(workspace_id)));

-- Owner confirms the offer and dates exactly as entered.
create or replace function public.confirm_campaign_facts(p_campaign_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid;
  offer text;
  confirmed timestamptz := now();
begin
  select c.workspace_id, c.offer_text into ws, offer
  from public.campaigns c where c.id = p_campaign_id;
  if ws is null or not private.is_member(ws) then
    raise exception 'Campaign not found' using errcode = 'P0002';
  end if;
  if offer is null then
    raise exception 'Add the offer before confirming it' using errcode = '22023';
  end if;
  update public.campaigns
    set facts_confirmed_at = confirmed, facts_confirmed_by = auth.uid()
    where id = p_campaign_id;
  insert into public.audit_events (workspace_id, actor_id, action, entity, entity_id)
  values (ws, auth.uid(), 'campaign.facts_confirmed', 'campaign', p_campaign_id);
  return confirmed;
end;
$$;
revoke all on function public.confirm_campaign_facts(uuid) from public, anon;
grant execute on function public.confirm_campaign_facts(uuid) to authenticated;
