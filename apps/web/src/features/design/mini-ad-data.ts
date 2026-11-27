import { checkRecipe, CTA_LABELS, formatPrice, type AdRecipe } from '@admitra/styles-engine';
import type { Campaign } from '@/features/campaigns/api';
import type { Tables } from '@/types/database';
import type { MiniAdData } from './mini-ad';

const PALETTES = [
  { bg: '#2a1a10', ink: '#fff8ee', accent: '#f2a541' },
  { bg: '#14251c', ink: '#f4f1e6', accent: '#ffe9a8' },
  { bg: '#0f2a2e', ink: '#fffaf0', accent: '#fcd34d' },
  { bg: '#232259', ink: '#ffffff', accent: '#e8b04b' },
  { bg: '#3a0a1c', ink: '#fff4d6', accent: '#e8b04b' },
];

/** The quick look of a saved campaign: its chosen design's colours and words when it has one. */
export function campaignMini(
  c: Campaign,
  business: { name: string; industry: string; specialities: string[] },
  product: Tables<'products'> | null | undefined,
  photo: string | null,
  index = 0,
): MiniAdData {
  const recipe: AdRecipe | null = c.design
    ? checkRecipe(c.design, {
        sector: 'other',
        purpose: 'promote',
        language: 'en',
        businessName: business.name,
        productName: product?.name ?? null,
        specialities: business.specialities,
        hasPhoto: Boolean(photo),
      })
    : null;
  const palette = recipe
    ? { bg: recipe.palette.bg, ink: recipe.palette.ink, accent: recipe.palette.accent }
    : PALETTES[index % PALETTES.length]!;
  const lang = (c.language in CTA_LABELS ? c.language : 'en') as keyof typeof CTA_LABELS;
  const ctas = CTA_LABELS[lang] as Record<string, string>;
  return {
    photo,
    line1: recipe?.headline.text ?? c.headline ?? product?.name ?? c.name,
    line2: recipe?.headline.accent ?? null,
    price:
      product && product.price !== null && product.price_confirmed_at
        ? formatPrice(Number(product.price))
        : null,
    cta: recipe?.cta ?? ctas[c.cta] ?? 'Order now',
    business: business.name,
    ...palette,
  };
}
