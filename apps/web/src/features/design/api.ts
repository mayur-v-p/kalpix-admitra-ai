import {
  adExtras,
  checkRecipe,
  sectorOf,
  surpriseRecipe,
  type AdRecipe,
  type ComposerExtras,
  type Language,
  type Purpose,
  type RecipeContext,
} from '@admitra/styles-engine';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';
import type { Campaign } from '@/features/campaigns/api';

export type Business = Tables<'business_profiles'>;
export type Looks = { recipes: AdRecipe[]; source: 'ai' | 'surprise' };

export function recipeContext(
  c: Pick<Campaign, 'purpose' | 'language'>,
  business: Pick<Business, 'name' | 'industry' | 'specialities'>,
  productName: string | null,
  hasPhoto: boolean,
): RecipeContext {
  return {
    sector: sectorOf(business.industry),
    purpose: c.purpose as Purpose,
    language: c.language as Language,
    businessName: business.name,
    productName,
    specialities: business.specialities ?? [],
    hasPhoto,
  };
}

/** Confirmed extra facts for the Composer (hours, registration). Unconfirmed = left off. */
export function composerExtras(business: Business): ComposerExtras {
  return adExtras({ ...business, details_confirmed: Boolean(business.details_confirmed_at) });
}

/** Three looks without AI, as different from each other as the rules allow. */
export function surpriseLooks(ctx: RecipeContext, avoid: string[] = []): AdRecipe[] {
  const out: AdRecipe[] = [];
  const base = Math.floor(Math.random() * 1e9);
  for (let i = 0; out.length < 3 && i < 40; i++) {
    const r = surpriseRecipe(base + i * 7919, ctx);
    const clash = out.some(
      (o) => o.layout === r.layout || (o.palette.bg === r.palette.bg && o.fonts === r.fonts),
    );
    if (!clash && !avoid.includes(r.name)) out.push(r);
  }
  for (let i = 0; out.length < 3; i++) out.push(surpriseRecipe(base + 99991 * (i + 1), ctx));
  return out;
}

const TIMEOUT_MS = 45000;

/** Asks the AI art director for 3 looks; falls back to the surprise designer on any problem. */
export async function designLooks(
  campaignId: string,
  ctx: RecipeContext,
  avoid: string[],
): Promise<Looks> {
  const call = supabase.functions
    .invoke<{ designs: unknown[] }>('design-ad', { body: { campaignId, count: 3, avoid } })
    .then(({ data, error }) => (error || !data?.designs?.length ? null : data.designs))
    .catch(() => null);
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS));
  const designs = await Promise.race([call, timeout]);
  if (designs)
    return { recipes: designs.slice(0, 3).map((d) => checkRecipe(d, ctx)), source: 'ai' };
  return { recipes: surpriseLooks(ctx, avoid), source: 'surprise' };
}
