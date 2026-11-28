// Loads what the AI art director may know about a campaign (design-ad, edit-design).
//
// Read with the caller's client, so RLS decides access. The brief carries the business,
// product and purpose, and only WHETHER there is a photo, offer or price: never the price,
// offer, dates, phone or address themselves.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { DesignBrief } from './design-kit.ts';
import { adImagePath } from './photo.ts';

export type LoadedBrief = {
  workspaceId: string;
  brief: DesignBrief;
  /** Storage path of the photo the ad uses (product image, else the main business photo). */
  photoPath: string | null;
  /** The photo for the AI to look at: the owner's original upload (small JPEG, same colours). */
  visionPath: string | null;
};

export async function loadDesignBrief(
  asUser: SupabaseClient,
  campaignId: string,
  avoid: string[] = [],
): Promise<LoadedBrief | null> {
  const { data: campaign } = await asUser
    .from('campaigns')
    .select(
      'id, workspace_id, purpose, language, offer_text, product_id, business:business_profiles(id, name, industry, description, specialities)',
    )
    .eq('id', campaignId)
    .maybeSingle();
  if (!campaign) return null;

  const business = (
    Array.isArray(campaign.business) ? campaign.business[0] : campaign.business
  ) as {
    id: string;
    name: string;
    industry: string;
    description: string | null;
    specialities: string[];
  } | null;

  const [{ data: product }, { data: kit }, { data: mainPhoto }, { data: pictures }] =
    await Promise.all([
      campaign.product_id
        ? asUser
            .from('products')
            .select(
              'name, description, price, image_path, cutout_path, cutout_status, enhanced_path, enhanced_status, use_enhanced',
            )
            .eq('id', campaign.product_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      asUser
        .from('brand_kits')
        .select('primary_color, secondary_color, accent_color')
        .eq('workspace_id', campaign.workspace_id)
        .maybeSingle(),
      !campaign.product_id && business
        ? asUser
            .from('business_photos')
            .select('path')
            .eq('business_id', business.id)
            .order('is_main', { ascending: false })
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      campaign.product_id
        ? asUser
            .from('product_pictures')
            .select('id, label, kind, path')
            .eq('product_id', campaign.product_id)
            .eq('use_in_ads', true)
            .order('created_at', { ascending: false })
            .limit(12)
        : Promise.resolve({ data: [] }),
    ]);

  const ticked = (pictures ?? []) as {
    id: string;
    label: string | null;
    kind: string;
    path: string;
  }[];
  // A product without a photo uses its newest ticked AI picture (same rule as the export).
  const photoPath = campaign.product_id
    ? (adImagePath(product) ?? ticked[0]?.path ?? null)
    : (mainPhoto?.path ?? null);
  return {
    workspaceId: campaign.workspace_id,
    photoPath,
    visionPath: campaign.product_id ? (product?.image_path ?? photoPath) : photoPath,
    brief: {
      sector: business?.industry ?? 'other',
      purpose: campaign.purpose,
      language: campaign.language as DesignBrief['language'],
      businessName: business?.name ?? 'Our shop',
      description: business?.description?.slice(0, 300) ?? null,
      productName: product?.name ?? null,
      productDescription: product?.description?.slice(0, 300) ?? null,
      specialities: business?.specialities ?? [],
      brandColors: [kit?.primary_color, kit?.secondary_color, kit?.accent_color].filter(
        (c): c is string => typeof c === 'string',
      ),
      hasPhoto: Boolean(photoPath),
      hasOffer: Boolean(campaign.offer_text),
      hasPrice: product?.price != null,
      avoid,
      pictures: ticked.map(({ id, label, kind }) => ({ id, label, kind })),
    },
  };
}
