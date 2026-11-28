import {
  adExtras,
  pickBest,
  sectorOf,
  surpriseRecipe,
  type AdRecipe,
  type ComposerExtras,
  type Language,
  type Purpose,
  type RecipeContext,
  type ScoredLook,
} from '@admitra/styles-engine';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';
import type { Campaign } from '@/features/campaigns/api';

export type Business = Tables<'business_profiles'>;
/** What the AI saw in the ad's photo (design-ad). */
export type PhotoReading = {
  subject: string | null;
  colours: { name: string; hex: string }[];
  mood: string[];
  sharp: boolean;
  goodLight: boolean;
  tip: string | null;
};
export type Looks = {
  /** The best three, most different first picks. */
  shown: ScoredLook[];
  /** The others, each with the reason it was not shown. */
  hidden: ScoredLook[];
  photo: PhotoReading | null;
  source: 'ai' | 'surprise';
};

/** How many designs are made for each "Design my ad"; the best three are shown. */
export const DESIGNS_MADE = 6;

export function recipeContext(
  c: Pick<Campaign, 'purpose' | 'language'>,
  business: Pick<Business, 'name' | 'industry' | 'specialities'>,
  productName: string | null,
  hasPhoto: boolean,
  /** AI pictures the owner ticked for ads (each design may use a different one). */
  pictureIds: string[] = [],
): RecipeContext {
  return {
    sector: sectorOf(business.industry),
    purpose: c.purpose as Purpose,
    language: c.language as Language,
    businessName: business.name,
    productName,
    specialities: business.specialities ?? [],
    hasPhoto: hasPhoto || pictureIds.length > 0,
    pictureIds,
  };
}

/** Confirmed extra facts for the Composer (hours, registration). Unconfirmed = left off. */
export function composerExtras(business: Business): ComposerExtras {
  return adExtras({ ...business, details_confirmed: Boolean(business.details_confirmed_at) });
}

/** Looks without AI, as different from each other as the rules allow. */
export function surpriseLooks(ctx: RecipeContext, avoid: string[] = [], count = 3): AdRecipe[] {
  const out: AdRecipe[] = [];
  const base = Math.floor(Math.random() * 1e9);
  for (let i = 0; out.length < count && i < 60; i++) {
    const r = surpriseRecipe(base + i * 7919, ctx);
    const clash = out.some(
      (o) => o.layout === r.layout || (o.palette.bg === r.palette.bg && o.fonts === r.fonts),
    );
    if (!clash && !avoid.includes(r.name)) out.push(r);
  }
  for (let i = 0; out.length < count; i++) out.push(surpriseRecipe(base + 99991 * (i + 1), ctx));
  // A different picture in each design: the main photo (null), then each ticked AI picture.
  const choices = [null, ...(ctx.pictureIds ?? [])];
  return out.map((r, i) => ({ ...r, picture: choices[i % choices.length] ?? null }));
}

const TIMEOUT_MS = 90000;
const HEX = /^#[0-9a-f]{6}$/i;
const text = (v: unknown, max: number) =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

/** The photo reading again, checked on this side too (it is shown on the page). */
export function checkPhotoReading(raw: unknown): PhotoReading | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const colours = (Array.isArray(r.colours) ? r.colours : [])
    .map((c) => (c ?? {}) as Record<string, unknown>)
    .filter((c) => typeof c.hex === 'string' && HEX.test(c.hex) && text(c.name, 24))
    .map((c) => ({ name: text(c.name, 24)!, hex: (c.hex as string).toLowerCase() }))
    .slice(0, 3);
  const mood = (Array.isArray(r.mood) ? r.mood : [])
    .map((m) => text(m, 16))
    .filter((m): m is string => Boolean(m))
    .slice(0, 3);
  return {
    subject: text(r.subject, 110),
    colours,
    mood,
    sharp: r.sharp !== false,
    goodLight: r.goodLight !== false,
    tip: text(r.tip, 130),
  };
}

/**
 * Asks the AI art director for six looks (it also looks at the photo), scores them and keeps
 * the best three. Falls back to the surprise designer on any problem.
 */
export async function designLooks(
  campaignId: string,
  ctx: RecipeContext,
  avoid: string[],
): Promise<Looks> {
  const call = supabase.functions
    .invoke<{ designs: unknown[]; photo: unknown }>('design-ad', {
      body: { campaignId, count: DESIGNS_MADE, avoid },
    })
    .then(({ data, error }) => (error || !data?.designs?.length ? null : data))
    .catch(() => null);
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS));
  const out = await Promise.race([call, timeout]);
  if (out) {
    const photo = checkPhotoReading(out.photo);
    const picked = pickBest(
      out.designs.slice(0, DESIGNS_MADE),
      ctx,
      photo?.colours.map((c) => c.hex),
    );
    return { ...picked, photo, source: 'ai' };
  }
  return {
    ...pickBest(surpriseLooks(ctx, avoid, DESIGNS_MADE), ctx),
    photo: null,
    source: 'surprise',
  };
}
