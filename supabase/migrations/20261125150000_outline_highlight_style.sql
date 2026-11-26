-- =====================================================================================
-- Product decision (25 Nov 2026): the Rope Build animation is replaced by "Outline
-- Highlight": one clean outline drawn around the product, the product name and the brand
-- name. Renames the style and its options; existing campaigns are moved over.
-- Column grants follow the renamed column automatically.
-- =====================================================================================

alter table public.campaigns rename column rope_material to outline_style;
alter table public.campaigns drop constraint campaigns_rope_material_check;
update public.campaigns set outline_style = 'brand' where outline_style = 'cord';
alter table public.campaigns alter column outline_style set default 'brand';
alter table public.campaigns
  add constraint campaigns_outline_style_check check (outline_style in ('brand', 'neon', 'gold'));

alter table public.campaigns drop constraint campaigns_style_id_check;
update public.campaigns set style_id = 'outline_highlight' where style_id = 'rope_build';
alter table public.campaigns alter column style_id set default 'outline_highlight';
alter table public.campaigns
  add constraint campaigns_style_id_check check (style_id in ('outline_highlight'));
