import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';
import { confirmCampaignFacts } from '@/features/campaigns/api';
import { confirmProductPrice, requestCutout, uploadProductPhoto } from '@/features/products/api';
import {
  campaignName,
  offerText,
  type AdCta,
  type AdGoal,
  type AdLanguage,
  type AdPurpose,
} from './parse';

/** What the owner checked on the "Check your ad" screen. */
export type CheckedAd = {
  goal: AdGoal;
  purpose?: AdPurpose;
  occasion?: string;
  product?: string;
  productId?: string;
  price?: number;
  discount?: number;
  from?: string;
  to?: string;
  time?: string;
  cta: AdCta;
  language: AdLanguage;
  /** Only for a first-time owner (e.g. the free try) who has no business profile yet. */
  businessName?: string;
  businessType?: 'food' | 'retail' | 'beauty' | 'other';
  photo?: File | null;
};

const must = <T>(r: { data: T; error: unknown }): NonNullable<T> => {
  if (r.error) throw r.error;
  if (r.data === null || r.data === undefined) throw new Error('The database returned no row.');
  return r.data;
};

/** The offer line drawn on the ad; dates alone still need an offer to be confirmed. */
export function adOffer(
  a: Pick<CheckedAd, 'price' | 'discount' | 'time' | 'occasion' | 'from' | 'to'>,
) {
  return (
    offerText(a.price, a.discount, a.time) ??
    (a.occasion ? `${a.occasion} offer` : a.from || a.to ? 'Special offer' : null)
  );
}

/**
 * Creates the ad from the checked details, using the same records and confirmations as the
 * typed forms: the business (first time only), the product (matched or new, with its price
 * confirmed) and the campaign (with its offer and dates confirmed). Returns the campaign id.
 * Every value here was shown to the owner and confirmed on the read-back.
 */
export async function createAdFromVoice(
  workspaceId: string,
  business: Tables<'business_profiles'> | null,
  a: CheckedAd,
): Promise<string> {
  let biz = business;
  if (!biz) {
    biz = must(
      await supabase
        .from('business_profiles')
        .insert({
          workspace_id: workspaceId,
          name: (a.businessName || 'My shop').slice(0, 120),
          industry: a.businessType ?? 'other',
        })
        .select()
        .single(),
    );
  }

  let productId: string | null = a.productId ?? null;
  if (productId && a.price) {
    const current = must(
      await supabase.from('products').select('price').eq('id', productId).single(),
    );
    if (Number(current.price) !== a.price) {
      must(
        await supabase
          .from('products')
          .update({ price: a.price })
          .eq('id', productId)
          .select('id')
          .single(),
      );
    }
  } else if (!productId && a.product) {
    const image_path = a.photo ? await uploadProductPhoto(workspaceId, a.photo) : null;
    const created = must(
      await supabase
        .from('products')
        .insert({
          workspace_id: workspaceId,
          business_id: biz.id,
          name: a.product.slice(0, 120),
          price: a.price ?? null,
          image_path,
        })
        .select('id')
        .single(),
    );
    productId = created.id;
    if (image_path) void requestCutout(productId).catch(() => undefined); // the background is removed in the background
  }
  if (productId && a.price) await confirmProductPrice(productId);

  const offer = adOffer(a);
  const campaign = must(
    await supabase
      .from('campaigns')
      .insert({
        workspace_id: workspaceId,
        business_id: biz.id,
        name: campaignName({ goal: a.goal, occasion: a.occasion, product: a.product }).slice(
          0,
          120,
        ),
        goal: a.goal,
        product_id: productId,
        offer_text: offer,
        start_date: a.from ?? null,
        end_date: a.to ?? a.from ?? null,
        cta: a.cta,
        language: a.language,
        purpose: a.purpose ?? 'promote',
      })
      .select('id')
      .single(),
  );
  if (offer) await confirmCampaignFacts(campaign.id);
  return campaign.id;
}
