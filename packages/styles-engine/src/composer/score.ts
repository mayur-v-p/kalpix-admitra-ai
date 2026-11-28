// Scores designs and keeps the best, most different few ("6 designs made, best 3 shown").
//
// Every design is checked for: easy to read on a phone, text contrast, and (when we know the
// photo's colours) whether its colours suit the photo. The best one is picked first; each next
// pick also loses points for looking like one already picked, so the three shown differ.
// The rest are "hidden", each with a plain reason the owner can read.
import { checkRecipe, contrast, type AdRecipe, type RecipeContext } from './recipe';

export type LookScore = {
  /** 0-100: short headline, readable font and size. */
  readable: number;
  /** 0-100, from the weakest text contrast. */
  contrast: number;
  /** Weakest text contrast, e.g. "9.8:1". */
  contrastText: string;
  /** 0-100: colours that suit the photo; null when the photo's colours are unknown. */
  fit: number | null;
  /** The designed colours were hard to read and had to be changed by the checker. */
  fixedColours: boolean;
  total: number;
};

export type ScoredLook = {
  recipe: AdRecipe;
  /** The art director's own reason, shown under the look. */
  why: string | null;
  score: LookScore;
  /** Only for hidden looks: why it was not shown. */
  hiddenReason?: string;
};

const HEX = /^#[0-9a-f]{6}$/i;
const clamp = (v: number, lo = 0, hi = 100) => Math.round(Math.min(hi, Math.max(lo, v)));
const DEVANAGARI = /[ऀ-ॿ]/;

function hsl(hex: string): { h: number; s: number; l: number } {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return { h: h < 0 ? h + 360 : h, s, l };
}

const hueGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/** How easy the words are to read on a phone in two seconds. */
export function readability(r: AdRecipe): number {
  const len = (t: string) => (DEVANAGARI.test(t) ? t.length * 1.2 : t.length);
  let s = 100;
  s -= Math.max(0, len(r.headline.text) - 18) * 1.6;
  if (r.headline.accent) s -= Math.max(0, len(r.headline.accent) - 12) * 0.8;
  if (r.headline.upper && r.headline.text.length > 16) s -= 6;
  if (r.headline.size < 0.9) s -= 8;
  if (r.fonts === 'handwritten') s -= 10;
  if (r.fonts === 'elegant') s -= 4;
  if (r.tagline && len(r.tagline) > 50) s -= 6;
  if (r.chips.length > 3) s -= 4;
  return clamp(s, 30);
}

/** Do the design's background and accent sit well with the photo's own colours? */
export function photoFit(r: AdRecipe, photoColours: string[]): number | null {
  const colours = photoColours.filter((c) => HEX.test(c)).map(hsl);
  if (!colours.length) return null;
  const vivid = colours.filter((c) => c.s > 0.18 && c.l > 0.08 && c.l < 0.92);
  const one = (hex: string, neutralScore: number) => {
    const c = hsl(hex);
    // Near-white, near-black and greys suit any photo.
    if (c.s < 0.15 || c.l < 0.1 || c.l > 0.93) return neutralScore;
    if (!vivid.length) return 70;
    const gap = Math.min(...vivid.map((p) => hueGap(p.h, c.h)));
    // Same family is best; a clear complement (around 180) also works; in between clashes.
    return gap <= 30 ? 100 - gap : gap >= 150 ? 80 : Math.max(35, 100 - gap * 0.75);
  };
  const bg = (one(r.palette.bg, 88) + one(r.palette.bg2, 88)) / 2;
  return clamp(bg * 0.6 + one(r.palette.accent, 85) * 0.4, 30);
}

/** Checks a raw design (AI or surprise) and scores it. */
export function scoreLook(raw: unknown, ctx: RecipeContext, photoColours: string[] = []) {
  const recipe = checkRecipe(raw, ctx);
  const p = recipe.palette;
  const asked = ((raw ?? {}) as { palette?: Record<string, unknown> }).palette ?? {};
  const changed = (k: 'ink' | 'accent' | 'onAccent') =>
    typeof asked[k] === 'string' && (asked[k] as string).toLowerCase() !== p[k];
  const fixedColours = changed('ink') || changed('accent') || changed('onAccent');
  const textRatio = Math.min(contrast(p.ink, p.bg), contrast(p.ink, p.bg2));
  const readable = readability(recipe);
  const contrastScore = clamp(50 + (textRatio - 4.5) * 10 - (fixedColours ? 20 : 0), 20);
  const fit = photoFit(recipe, photoColours);
  const total = Math.round(readable * 0.4 + contrastScore * 0.3 + (fit ?? 80) * 0.3);
  const why = (raw as { why?: unknown } | null)?.why;
  return {
    recipe,
    why: typeof why === 'string' && why.trim() ? why.trim().slice(0, 130) : null,
    score: {
      readable,
      contrast: contrastScore,
      contrastText: `${textRatio >= 10 ? Math.round(textRatio) : textRatio.toFixed(1)}:1`,
      fit,
      fixedColours,
      total,
    } satisfies LookScore,
  };
}

/** 0-100: how much two designs look alike. */
export function likeness(a: AdRecipe, b: AdRecipe): number {
  let s = 0;
  if (a.layout === b.layout) s += 40;
  if (a.fonts === b.fonts) s += 15;
  if (a.background === b.background) s += 15;
  // The same picture looks alike even in a different layout.
  if ((a.picture ?? null) === (b.picture ?? null)) s += 10;
  const ha = hsl(a.palette.bg);
  const hb = hsl(b.palette.bg);
  const sameLight = Math.abs(ha.l - hb.l) < 0.15;
  const sameHue = ha.s < 0.15 && hb.s < 0.15 ? true : hueGap(ha.h, hb.h) < 25;
  if (sameLight && sameHue) s += 30;
  return Math.min(100, s);
}

/** Keeps the best `keep` looks that also differ from each other; the rest come back hidden. */
export function pickBest(
  raws: unknown[],
  ctx: RecipeContext,
  photoColours: string[] = [],
  keep = 3,
): { shown: ScoredLook[]; hidden: ScoredLook[] } {
  const pool: ScoredLook[] = raws.map((r) => scoreLook(r, ctx, photoColours));
  const shown: ScoredLook[] = [];
  const left = [...pool];
  while (shown.length < keep && left.length) {
    let best = 0;
    let bestValue = -Infinity;
    left.forEach((l, i) => {
      const like = Math.max(0, ...shown.map((s) => likeness(s.recipe, l.recipe)));
      const value = l.score.total - like * 0.5;
      if (value > bestValue) {
        bestValue = value;
        best = i;
      }
    });
    shown.push(left.splice(best, 1)[0]!);
  }
  const hidden = left.map((l) => ({ ...l, hiddenReason: hiddenReason(l, shown) }));
  return { shown, hidden };
}

function hiddenReason(l: ScoredLook, shown: ScoredLook[]): string {
  const closest = [...shown].sort(
    (a, b) => likeness(b.recipe, l.recipe) - likeness(a.recipe, l.recipe),
  )[0];
  const like = closest ? likeness(closest.recipe, l.recipe) : 0;
  if (closest && like >= 55) return `Too much like “${closest.recipe.name}”.`;
  // It scored as well as a shown one: it was left out to keep the three different.
  if (closest && like >= 25 && l.score.total >= Math.min(...shown.map((s) => s.score.total)))
    return `Close to “${closest.recipe.name}”, so a more different design was shown.`;
  if (l.score.readable < 70) return 'The words would be hard to read on a phone.';
  if (l.score.fixedColours) return 'Its colours were hard to read and had to be changed.';
  if (l.score.fit !== null && l.score.fit < 60) return 'Its colours do not suit your photo.';
  return 'Scored a little lower than the three above.';
}
