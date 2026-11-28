// "Change something" in the Studio: the owner says or types a change, and the AI art director
// (Edge Function edit-design) returns the same design with only that change.
//
// Without an AI key (or if the AI fails) the suggestion buttons still work with the simple,
// rule-based edits below. The AI never changes facts: prices, offers, dates, phone and address
// are not part of the design at all.
import {
  checkPalette,
  checkRecipe,
  mix,
  PRESET_PALETTES,
  readableOn,
  type Accent,
  type AdRecipe,
  type Background,
  type RecipeContext,
} from '@admitra/styles-engine';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type QuickEdit = 'festive' | 'photo' | 'brand' | 'short' | 'calm';
export type DesignChange = { title: string; detail: string };

export const QUICK_EDITS: { id: QuickEdit; label: string; request: string }[] = [
  { id: 'festive', label: 'More festive', request: 'Make it more festive' },
  { id: 'photo', label: 'Bigger photo', request: 'Make the photo bigger' },
  { id: 'brand', label: 'Use my brand colours', request: 'Use my brand colours' },
  { id: 'short', label: 'Shorter headline', request: 'Make the headline shorter' },
  { id: 'calm', label: 'Calmer', request: 'Make it calmer, with less movement' },
];

export type EditResult =
  | { kind: 'done'; recipe: AdRecipe; changes: DesignChange[]; source: 'ai' | 'basic' }
  /** The owner asked to change a price, offer, date, phone or address. */
  | { kind: 'facts' }
  /** Nothing could be changed (e.g. no brand colours yet); `message` says why. */
  | { kind: 'none'; message: string };

/** Words that mean a fact (price, offer, date, phone, address), in the languages owners use. */
export const FACT_WORDS =
  /₹|\d|\b(price|rate|daam|dam|kimat|keemat|discount|chhoot|chhut|offer|phone|mobile|number|address|pata|date|tarikh|timing)\b|कीमत|दाम|छूट|ऑफर|फोन|पता|तारीख|किंमत|सवलत/i;

/** Free words that match a suggestion, for edits without AI. */
const QUICK_WORDS: Record<QuickEdit, RegExp> = {
  festive: /festive|festival|diwali|tyohar|tyohaar|utsav|त्योहार|त्यौहार|दिवाली|सण|उत्सव/i,
  photo:
    /\b(bada|badi|bigger|large|larger)\b.*\b(photo|image|picture|tasveer)\b|\b(photo|image|picture|tasveer)\b.*\b(bada|badi|bigger|large|larger)\b|फोटो.*बड़|बड़.*फोटो/i,
  brand: /\bbrand\b|my colou?rs?|mere colou?r|ब्रांड/i,
  short: /\b(short|shorter|chhota|chhoti|kam shabd)\b|छोटा|छोटी/i,
  calm: /\b(calm|calmer|slow|slower|simple|shant|halka)\b|शांत|सादा/i,
};

export function quickEditFor(text: string): QuickEdit | null {
  const hit = (Object.keys(QUICK_WORDS) as QuickEdit[]).find((k) => QUICK_WORDS[k].test(text));
  return hit ?? null;
}

const unique = <T>(list: T[]) => list.filter((x, i) => list.indexOf(x) === i);
const LOUD_ACCENTS: Accent[] = ['sparkles', 'marquee', 'pulse_line'];
const LOUD_BACKGROUNDS: Background[] = ['confetti', 'particles', 'neon_grid', 'rays'];

/** The simple, rule-based version of each suggestion (no AI needed). */
export function basicEdit(
  id: QuickEdit,
  r: AdRecipe,
  ctx: RecipeContext,
  brandColors: string[],
): EditResult {
  const done = (next: Partial<AdRecipe>, change: DesignChange): EditResult => ({
    kind: 'done',
    recipe: checkRecipe({ ...r, ...next }, ctx),
    changes: [change],
    source: 'basic',
  });
  switch (id) {
    case 'festive':
      return done(
        {
          palette: checkPalette(PRESET_PALETTES.diwali, PRESET_PALETTES.diwali!),
          background: 'rangoli',
          accents: unique<Accent>(['diyas', 'sparkles', ...r.accents]).slice(0, 3),
        },
        {
          title: 'More festive',
          detail: 'Deep maroon and gold colours, a rangoli background, diyas and sparkles.',
        },
      );
    case 'photo': {
      if (!ctx.hasPhoto) return { kind: 'none', message: 'This ad has no photo yet.' };
      if (r.photo.scale < 1.2)
        return done(
          { photo: { ...r.photo, scale: Math.min(1.2, r.photo.scale + 0.2) } },
          { title: 'Bigger photo', detail: 'The photo is larger; the words moved to make room.' },
        );
      return done(
        { layout: 'photo_band', photo: { ...r.photo, shape: 'full' } },
        { title: 'Bigger photo', detail: 'The photo now fills the top of the ad.' },
      );
    }
    case 'brand': {
      const [main, second, accent] = brandColors;
      if (!main)
        return {
          kind: 'none',
          message: 'Add your brand colours on the Business page first.',
        };
      const pick = accent ?? second ?? readableOn(main);
      return done(
        {
          palette: checkPalette(
            {
              bg: main,
              bg2: mix(main, '#000000', 0.18),
              ink: readableOn(main),
              accent: pick,
              onAccent: readableOn(pick),
            },
            r.palette,
          ),
        },
        { title: 'Your brand colours', detail: 'The colours now come from your brand kit.' },
      );
    }
    case 'short': {
      if (r.headline.accent)
        return done(
          { headline: { ...r.headline, accent: null } },
          { title: 'Shorter headline', detail: 'The second headline line was removed.' },
        );
      const words = r.headline.text.split(' ');
      if (words.length > 3)
        return done(
          { headline: { ...r.headline, text: words.slice(0, 3).join(' ') } },
          { title: 'Shorter headline', detail: 'The headline now has only three words.' },
        );
      if (r.tagline)
        return done(
          { tagline: null },
          { title: 'Fewer words', detail: 'The small line under the headline was removed.' },
        );
      return { kind: 'none', message: 'The headline is already short.' };
    }
    case 'calm':
      return done(
        {
          rhythm: 'calm',
          accents: r.accents.filter((a) => !LOUD_ACCENTS.includes(a)),
          background: LOUD_BACKGROUNDS.includes(r.background) ? 'gradient' : r.background,
        },
        { title: 'Calmer', detail: 'Slower movement and fewer moving pieces.' },
      );
  }
}

const TIMEOUT_MS = 45000;
type ServerEdit = { factsRequest: boolean; design: unknown; changes: DesignChange[] };

/** Asks the AI; `null` means "AI not available" (no key, error or too slow). */
async function askAi(
  campaignId: string,
  recipe: AdRecipe,
  request: string,
): Promise<ServerEdit | 'rate_limited' | null> {
  const call = supabase.functions
    .invoke<ServerEdit>('edit-design', { body: { campaignId, design: recipe, request } })
    .then(async ({ data, error }) => {
      if (error instanceof FunctionsHttpError) {
        const body = await error.context.json().catch(() => null);
        return body?.error === 'rate_limited' ? ('rate_limited' as const) : null;
      }
      return error || !data ? null : data;
    })
    .catch(() => null);
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS));
  return Promise.race([call, timeout]);
}

/** Same look? Ignores key order (saved designs come back from the database reordered). */
const canon = (v: unknown) =>
  JSON.stringify(v, (_k, val: unknown) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => (a < b ? -1 : 1)))
      : val,
  );
export const sameLook = (a: AdRecipe, b: AdRecipe) => canon(a) === canon(b);

/**
 * Makes one change to a design. Tries the AI first; for the suggestion buttons (or free words
 * that match one) it falls back to the basic edit when the AI is not available.
 */
export async function editDesign(input: {
  campaignId: string;
  recipe: AdRecipe;
  request: string;
  ctx: RecipeContext;
  brandColors: string[];
  quick?: QuickEdit;
}): Promise<EditResult> {
  const request = input.request.trim().slice(0, 200);
  const quick = input.quick ?? quickEditFor(request);
  const ai = await askAi(input.campaignId, input.recipe, request);
  if (ai === 'rate_limited')
    return { kind: 'none', message: 'You have made a lot of changes this hour. Try again later.' };
  if (ai?.factsRequest) return { kind: 'facts' };
  if (ai?.design) {
    const recipe = checkRecipe(ai.design, input.ctx);
    if (!sameLook(recipe, input.recipe))
      return {
        kind: 'done',
        recipe,
        changes: ai.changes?.length ? ai.changes : [{ title: 'Changed', detail: request }],
        source: 'ai',
      };
  }
  if (!quick && FACT_WORDS.test(request)) return { kind: 'facts' };
  if (quick) return basicEdit(quick, input.recipe, input.ctx, input.brandColors);
  return {
    kind: 'none',
    message: ai
      ? 'Kalpix could not see what to change. Try saying it another way, or pick a suggestion.'
      : 'AI changes are not switched on here. Pick one of the suggestions instead.',
  };
}
