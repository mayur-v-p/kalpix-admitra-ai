import type { Purpose } from '@admitra/styles-engine';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';
import { PURPOSE_LABELS } from './labels';

type Business = Pick<Tables<'business_profiles'>, 'id' | 'workspace_id' | 'name' | 'languages'>;
type Product = Pick<Tables<'products'>, 'id' | 'name'>;

const GOAL: Record<Purpose, string> = {
  promote: 'visit',
  menu: 'sale',
  new_arrivals: 'new_product',
  festival: 'festival',
  opening: 'visit',
  offer: 'sale',
};

/**
 * One tap from the dashboard, a product card or "My Ads": a new ad with its purpose (and the
 * product, if any). The Studio opens and the AI art director designs it straight away.
 */
export async function createQuickAd(
  business: Business,
  purpose: Purpose,
  product?: Product | null,
): Promise<string> {
  const language = business.languages?.[0] ?? 'en';
  const name = (
    product ? `${product.name} · ${PURPOSE_LABELS[purpose]}` : PURPOSE_LABELS[purpose]
  ).slice(0, 120);
  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      workspace_id: business.workspace_id,
      business_id: business.id,
      name,
      goal: GOAL[purpose],
      purpose,
      product_id: product?.id ?? null,
      language,
      cta: purpose === 'promote' || purpose === 'opening' ? 'visit' : 'whatsapp',
    })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('The ad could not be created.');
  return data.id;
}

/** Router state that tells the Studio to start designing right away. */
export type StudioState = { autoDesign?: boolean };
