// The "design recipe": everything the AI art director (or the no-key surprise generator)
// decides about one ad. The Composer draws any checked recipe, in the browser preview and in
// the render worker alike.
//
// Freedom with guard rails: the director chooses layout, pieces, colours (any colours),
// rotation, sizes, alignment, timing and the words. checkRecipe() keeps every value inside
// safe limits, fixes colours that would be hard to read, and drops words that break the rules
// (no numbers or prices from AI, no medical claims). Facts (price, offer, dates, timings,
// registration numbers) never come from the recipe: the Composer takes them from confirmed
// fields only.

export const LAYOUTS = ['spotlight', 'photo_band', 'editorial', 'arch', 'list', 'story'] as const;
export const ENTERS = [
  'rise',
  'pop',
  'unmask',
  'wipe',
  'iris',
  'tilt',
  'stamp',
  'swing',
  'flicker',
  'slide_left',
  'slide_right',
  'blur',
  'drop',
  'zoom',
] as const;
export const BACKGROUNDS = [
  'orbs',
  'photo_zoom',
  'grid',
  'paper',
  'gradient',
  'particles',
  'confetti',
  'rangoli',
  'neon_grid',
  'rays',
] as const;
export const ACCENTS = [
  'steam',
  'sparkles',
  'diyas',
  'sweep',
  'marquee',
  'ring',
  'pulse_line',
  'icon',
] as const;
export const BADGES = ['none', 'ribbon', 'stamp', 'starburst', 'tag', 'pill'] as const;
export const PHOTO_SHAPES = [
  'arch',
  'circle',
  'rounded',
  'polaroid',
  'full',
  'blob',
  'none',
] as const;
export const FONT_PAIRS = [
  'modern',
  'editorial',
  'bold',
  'friendly',
  'elegant',
  'handwritten',
] as const;
export const ICONS = [
  'cup',
  'plate',
  'hanger',
  'sweets',
  'heart_cross',
  'pill',
  'test_tube',
  'dumbbell',
  'scissors',
  'book',
  'building',
  'phone',
  'tools',
  'star',
] as const;
export const RHYTHMS = ['calm', 'lively', 'punchy'] as const;
export const PURPOSES = [
  'promote',
  'menu',
  'new_arrivals',
  'festival',
  'opening',
  'offer',
] as const;
export const SECTORS = [
  'cafe',
  'restaurant',
  'sweets',
  'bakery',
  'grocery',
  'clothing',
  'jewellery',
  'electronics',
  'clinic',
  'pharmacy',
  'diagnostics',
  'fitness',
  'beauty',
  'education',
  'real_estate',
  'services',
  'other',
] as const;

export type Layout = (typeof LAYOUTS)[number];
export type Enter = (typeof ENTERS)[number];
export type Background = (typeof BACKGROUNDS)[number];
export type Accent = (typeof ACCENTS)[number];
export type Badge = (typeof BADGES)[number];
export type PhotoShape = (typeof PHOTO_SHAPES)[number];
export type FontPair = (typeof FONT_PAIRS)[number];
export type Icon = (typeof ICONS)[number];
export type Rhythm = (typeof RHYTHMS)[number];
export type Purpose = (typeof PURPOSES)[number];
export type Sector = (typeof SECTORS)[number];
export type Language = 'en' | 'hi' | 'mr' | 'hinglish';

export type Palette = { bg: string; bg2: string; ink: string; accent: string; onAccent: string };

export type AdRecipe = {
  v: 1;
  /** Short name the owner sees under the preview ("Diwali Gold"). */
  name: string;
  layout: Layout;
  background: Background;
  accents: Accent[];
  badge: Badge;
  icon: Icon | null;
  palette: Palette;
  fonts: FontPair;
  photo: { shape: PhotoShape; rotate: number; scale: number; enter: Enter };
  headline: {
    text: string;
    /** Optional second line drawn in the accent colour. */
    accent: string | null;
    size: number;
    align: 'left' | 'center';
    upper: boolean;
    enter: Enter;
  };
  tagline: string | null;
  /** Words from the owner's own specialities or categories only. */
  chips: string[];
  /** Button wording; null = the standard label for the campaign's CTA. */
  cta: string | null;
  rhythm: Rhythm;
  duration: 10 | 15;
};

/** What the checker needs to know about the business. */
export type RecipeContext = {
  sector: Sector;
  purpose: Purpose;
  language: Language;
  businessName: string;
  productName?: string | null;
  /** The owner's specialities / categories (chips may only use these). */
  specialities?: string[];
  hasPhoto: boolean;
};

// ------------------------------------------------------------------------------- colours
const HEX = /^#[0-9a-f]{6}$/i;

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = ([r, g, b]: number[]) =>
  '#' +
  [r, g, b]
    .map((c) =>
      Math.round(Math.min(255, Math.max(0, c!)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');

export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/** Mixes `hex` toward `to` by `amount` (0..1). */
export function mix(hex: string, to: string, amount: number): string {
  const a = rgb(hex);
  const b = rgb(to);
  return toHex(a.map((c, i) => c + (b[i]! - c) * amount));
}

const DARK = '#141418';
const LIGHT = '#ffffff';
/** Black-ish or white, whichever reads better on `bg` (always at least 4.5:1). */
export const readableOn = (bg: string) =>
  contrast(bg, DARK) >= contrast(bg, LIGHT) ? DARK : LIGHT;

/** Moves `fg` toward black or white until it has `min` contrast on `bg`. */
function ensureContrast(fg: string, bg: string, min: number): string {
  if (contrast(fg, bg) >= min) return fg;
  const target = readableOn(bg);
  for (let k = 0.1; k <= 1.0001; k += 0.1) {
    const c = mix(fg, target, k);
    if (contrast(c, bg) >= min) return c;
  }
  return target;
}

export function checkPalette(p: Partial<Palette> | undefined, fallback: Palette): Palette {
  const pick = (v: unknown, d: string) =>
    typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : d;
  const bg = pick(p?.bg, fallback.bg);
  const bg2 = pick(p?.bg2, fallback.bg2);
  // Text sits on both background stops: check against the one it reads worst on.
  const worstBg = (c: string) => (contrast(c, bg) < contrast(c, bg2) ? bg : bg2);
  let ink = pick(p?.ink, fallback.ink);
  ink = ensureContrast(ink, worstBg(ink), 4.5);
  let accent = pick(p?.accent, fallback.accent);
  accent = ensureContrast(accent, worstBg(accent), 3);
  const onAccent = ensureContrast(pick(p?.onAccent, readableOn(accent)), accent, 4.5);
  return { bg, bg2, ink, accent, onAccent };
}

// ------------------------------------------------------------------------------- words
/** Any digit or money/percent sign: AI words must not carry facts. */
const FACTY = /[0-9०-९₹%$]|\bRs\.?\b|\bINR\b|रु\.|रुपये|रुपए|रुपया|टक्के|प्रतिशत|percent/i;

/** Words a health business must not use in ads (claims, superlatives, guarantees). */
const HEALTH_BANNED =
  /\b(best|no\.?\s*1|number one|top|cure[sd]?|guarantee[sd]?|guaranteed|miracle|permanent|instant relief|100\s*%|risk[- ]free|painless|safest|expert[s]?\s+in\s+all)\b|सबसे\s*(अच्छा|बेहतरीन)|गारंटी|पक्का\s*इलाज|चमत्कार|सर्वोत्तम|हमखास|खात्रीशीर|best\s*doctor/i;
const HEALTH_SECTORS: Sector[] = ['clinic', 'pharmacy', 'diagnostics'];

export function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v
    .replace(/[\u0000-\u001f\u007f<>{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s && s.length <= max ? s : null;
}

/** Text the AI wrote: dropped if it carries numbers/prices (except the shop's own name) or claims. */
export function safeWords(v: unknown, max: number, ctx: RecipeContext): string | null {
  const s = cleanText(v, max);
  if (!s) return null;
  // Numbers inside the shop's or product's own name (e.g. "Cafe 24") are allowed.
  let rest = s;
  for (const own of [ctx.businessName, ctx.productName]) if (own) rest = rest.split(own).join('');
  if (FACTY.test(rest)) return null;
  if (HEALTH_SECTORS.includes(ctx.sector) && HEALTH_BANNED.test(s)) return null;
  return s;
}

// ------------------------------------------------------------------------------- defaults
export const PRESET_PALETTES: Record<string, Palette> = {
  indigo: { bg: '#2b2a6b', bg2: '#3b3a8f', ink: '#ffffff', accent: '#e8b04b', onAccent: '#1c1b3a' },
  diwali: { bg: '#3a0a1c', bg2: '#6b1430', ink: '#fff4d6', accent: '#e8b04b', onAccent: '#3a0a1c' },
  cafe: { bg: '#2a1a10', bg2: '#4a2c18', ink: '#fff8ee', accent: '#f2a541', onAccent: '#2a1a10' },
  chalk: { bg: '#14251c', bg2: '#2c4a3b', ink: '#f4f1e6', accent: '#ffe9a8', onAccent: '#1d3328' },
  cream: { bg: '#f4efe6', bg2: '#ebe3d4', ink: '#1d1b16', accent: '#b4532a', onAccent: '#ffffff' },
  mint: { bg: '#f4fbf9', bg2: '#d7ecf0', ink: '#12343b', accent: '#1f8a7d', onAccent: '#ffffff' },
  pharma: { bg: '#ffffff', bg2: '#dff3e7', ink: '#0d3b24', accent: '#15803d', onAccent: '#ffffff' },
  navy: { bg: '#0e1a3a', bg2: '#1b2a63', ink: '#f1f4ff', accent: '#ff8a6b', onAccent: '#0e1a3a' },
  lime: { bg: '#0b0b0c', bg2: '#1a1a1d', ink: '#f5f5f0', accent: '#c6ff3d', onAccent: '#0b0b0c' },
  blush: { bg: '#fbefeb', bg2: '#f6e1dc', ink: '#4a2c2a', accent: '#a86a5c', onAccent: '#ffffff' },
  paper: { bg: '#fffdf6', bg2: '#fdf6e3', ink: '#1e2a4a', accent: '#2563eb', onAccent: '#ffffff' },
  dusk: { bg: '#141a33', bg2: '#8b5a7a', ink: '#fdf6ee', accent: '#ffd79a', onAccent: '#141a33' },
  neon: { bg: '#07070f', bg2: '#1b1240', ink: '#f2f2ff', accent: '#22d3ee', onAccent: '#07070f' },
  pop: { bg: '#ffd23f', bg2: '#ffc21a', ink: '#1b1035', accent: '#e4007c', onAccent: '#ffffff' },
  sweets: { bg: '#4a0d06', bg2: '#c2410c', ink: '#fff3dc', accent: '#fbbf24', onAccent: '#4a0d06' },
  teal: { bg: '#0f2a2e', bg2: '#1c4a4f', ink: '#fffaf0', accent: '#fcd34d', onAccent: '#0f2a2e' },
};

const oneOf = <T extends string>(list: readonly T[], v: unknown, d: T): T =>
  list.includes(v as T) ? (v as T) : d;
const clamp = (v: unknown, lo: number, hi: number, d: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;

/**
 * Checks a recipe from the AI (or a saved one) and returns a safe, complete recipe.
 * Never throws: anything missing or wrong gets a sensible value.
 */
export function checkRecipe(raw: unknown, ctx: RecipeContext): AdRecipe {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const style = SECTOR_STYLE[ctx.sector] ?? SECTOR_STYLE.other;
  const palette = checkPalette(r.palette, PRESET_PALETTES[style.palettes[0]!]!);

  let layout = oneOf(LAYOUTS, r.layout, 'spotlight');
  // Layouts that need the photo fall back when there is none.
  if (!ctx.hasPhoto && (layout === 'photo_band' || layout === 'story')) layout = 'spotlight';
  let background = oneOf(BACKGROUNDS, r.background, 'gradient');
  if (!ctx.hasPhoto && background === 'photo_zoom') background = 'orbs';

  const accents = (Array.isArray(r.accents) ? r.accents : [])
    .filter((a: unknown): a is Accent => ACCENTS.includes(a as Accent))
    .filter((a: Accent, i: number, all: Accent[]) => all.indexOf(a) === i)
    .slice(0, 3);

  const specialities = (ctx.specialities ?? []).map((s) => s.toLowerCase());
  const chips = (Array.isArray(r.chips) ? r.chips : [])
    .map((c: unknown) => cleanText(c, 22))
    .filter(
      (c: string | null): c is string => Boolean(c) && specialities.includes(c!.toLowerCase()),
    )
    .slice(0, 4);

  const h = (r.headline ?? {}) as Record<string, unknown>;
  const headlineText = safeWords(h.text, 40, ctx) ?? defaultHeadline(ctx);
  let shape = oneOf(PHOTO_SHAPES, r.photo?.shape, ctx.hasPhoto ? 'rounded' : 'none');
  // The owner's photo is the heart of the ad: never hide it.
  if (ctx.hasPhoto && shape === 'none') shape = 'rounded';

  return {
    v: 1,
    name: cleanText(r.name, 30) ?? 'Fresh look',
    layout,
    background,
    accents,
    badge: oneOf(BADGES, r.badge, 'pill'),
    icon: ICONS.includes(r.icon) ? r.icon : style.icon,
    palette,
    fonts: oneOf(FONT_PAIRS, r.fonts, style.fonts[0]!),
    photo: {
      shape: ctx.hasPhoto ? shape : 'none',
      rotate: clamp(r.photo?.rotate, -8, 8, 0),
      scale: clamp(r.photo?.scale, 0.8, 1.2, 1),
      enter: oneOf(ENTERS, r.photo?.enter, 'rise'),
    },
    headline: {
      text: headlineText,
      accent: safeWords(h.accent, 30, ctx),
      size: clamp(h.size, 0.8, 1.3, 1),
      align: h.align === 'left' ? 'left' : 'center',
      upper: h.upper === true,
      enter: oneOf(ENTERS, h.enter, 'rise'),
    },
    tagline: safeWords(r.tagline, 70, ctx),
    chips,
    cta: safeWords(r.cta, 28, ctx),
    rhythm: oneOf(RHYTHMS, r.rhythm, 'lively'),
    duration: r.duration === 15 ? 15 : 10,
  };
}

// ------------------------------------------------------------------------------- sector looks
type SectorStyle = { palettes: string[]; fonts: FontPair[]; icon: Icon; accents: Accent[] };

export const SECTOR_STYLE: Record<Sector, SectorStyle> = {
  cafe: {
    palettes: ['cafe', 'cream', 'chalk'],
    fonts: ['editorial', 'handwritten', 'modern'],
    icon: 'cup',
    accents: ['steam', 'sweep'],
  },
  restaurant: {
    palettes: ['teal', 'cafe', 'diwali'],
    fonts: ['editorial', 'elegant', 'bold'],
    icon: 'plate',
    accents: ['steam', 'sparkles'],
  },
  sweets: {
    palettes: ['sweets', 'diwali', 'pop'],
    fonts: ['friendly', 'editorial'],
    icon: 'sweets',
    accents: ['sparkles', 'diyas'],
  },
  bakery: {
    palettes: ['cream', 'blush', 'cafe'],
    fonts: ['handwritten', 'editorial'],
    icon: 'cup',
    accents: ['sparkles', 'sweep'],
  },
  grocery: {
    palettes: ['pharma', 'pop', 'paper'],
    fonts: ['friendly', 'modern'],
    icon: 'star',
    accents: ['marquee', 'sweep'],
  },
  clothing: {
    palettes: ['cream', 'blush', 'diwali'],
    fonts: ['bold', 'editorial', 'elegant'],
    icon: 'hanger',
    accents: ['sweep', 'sparkles'],
  },
  jewellery: {
    palettes: ['diwali', 'navy', 'cream'],
    fonts: ['elegant', 'editorial'],
    icon: 'star',
    accents: ['sparkles', 'sweep'],
  },
  electronics: {
    palettes: ['neon', 'navy', 'lime'],
    fonts: ['modern', 'bold'],
    icon: 'phone',
    accents: ['ring', 'sweep'],
  },
  clinic: {
    palettes: ['mint', 'navy', 'paper'],
    fonts: ['editorial', 'modern'],
    icon: 'heart_cross',
    accents: ['pulse_line', 'sweep'],
  },
  pharmacy: {
    palettes: ['pharma', 'mint'],
    fonts: ['modern', 'friendly'],
    icon: 'pill',
    accents: ['sweep', 'ring'],
  },
  diagnostics: {
    palettes: ['navy', 'mint'],
    fonts: ['modern', 'editorial'],
    icon: 'test_tube',
    accents: ['ring', 'pulse_line'],
  },
  fitness: {
    palettes: ['lime', 'neon', 'pop'],
    fonts: ['bold', 'modern'],
    icon: 'dumbbell',
    accents: ['marquee', 'sweep'],
  },
  beauty: {
    palettes: ['blush', 'cream', 'dusk'],
    fonts: ['elegant', 'editorial'],
    icon: 'scissors',
    accents: ['sparkles', 'sweep'],
  },
  education: {
    palettes: ['paper', 'indigo', 'pop'],
    fonts: ['handwritten', 'friendly'],
    icon: 'book',
    accents: ['sparkles', 'marquee'],
  },
  real_estate: {
    palettes: ['dusk', 'navy', 'cream'],
    fonts: ['editorial', 'elegant'],
    icon: 'building',
    accents: ['sparkles', 'sweep'],
  },
  services: {
    palettes: ['indigo', 'teal', 'paper'],
    fonts: ['modern', 'friendly'],
    icon: 'tools',
    accents: ['sweep', 'ring'],
  },
  other: {
    palettes: ['indigo', 'cream', 'teal'],
    fonts: ['modern', 'editorial'],
    icon: 'star',
    accents: ['sweep', 'sparkles'],
  },
};

/**
 * Confirmed extra facts for the Composer: opening hours and the registration line (RERA for
 * real estate, registration for health businesses). Nothing unconfirmed is returned.
 * Shared by the preview and the render worker.
 */
export function adExtras(b: {
  industry: string | null;
  opening_hours: string | null;
  registration_no: string | null;
  details_confirmed: boolean;
}): { hours: string | null; registration: string | null } {
  if (!b.details_confirmed) return { hours: null, registration: null };
  const sector = sectorOf(b.industry);
  const reg = b.registration_no;
  return {
    hours: b.opening_hours,
    registration: !reg
      ? null
      : sector === 'real_estate'
        ? `RERA No. ${reg}`
        : sector === 'clinic' || sector === 'diagnostics' || sector === 'pharmacy'
          ? `Reg. No. ${reg}`
          : null,
  };
}

/** Legacy business types (M2) to sectors. */
export function sectorOf(industry: string | null | undefined): Sector {
  if (SECTORS.includes(industry as Sector)) return industry as Sector;
  if (industry === 'food') return 'restaurant';
  if (industry === 'retail') return 'clothing';
  return 'other';
}

// ------------------------------------------------------------------------------- words with no AI
const HEADLINES: Record<Purpose, Record<Language, string[]>> = {
  promote: {
    en: [
      'Your neighbourhood favourite',
      'Come say hello',
      'Made for you, every day',
      'Good things live here',
    ],
    hi: ['आपकी अपनी पसंदीदा जगह', 'आइए, मिलते हैं', 'हर दिन, आपके लिए'],
    mr: ['तुमची आवडती जागा', 'या, भेटूया', 'रोज, खास तुमच्यासाठी'],
    hinglish: ['Aapki favourite jagah', 'Aao, milte hain', 'Har din, aapke liye'],
  },
  menu: {
    en: ["Today's specials", 'Fresh on the menu', 'Pick your favourite'],
    hi: ['आज का खास', 'मेन्यू में ताज़ा', 'अपनी पसंद चुनिए'],
    mr: ['आजचे खास', 'मेन्यूमध्ये ताजे', 'तुमची आवड निवडा'],
    hinglish: ['Aaj ka special', 'Menu mein fresh', 'Apni pasand chuno'],
  },
  new_arrivals: {
    en: ['Just arrived', 'New in store', 'The new collection'],
    hi: ['नया आया है', 'नई रेंज, नया अंदाज़', 'नया कलेक्शन'],
    mr: ['नवीन आले आहे', 'नवी रेंज', 'नवीन कलेक्शन'],
    hinglish: ['Naya aaya hai', 'Nayi range aa gayi', 'New collection'],
  },
  festival: {
    en: ['Celebrate with us', 'Festive wishes', 'Make it special'],
    hi: ['त्योहार की शुभकामनाएँ', 'खुशियाँ मनाइए हमारे साथ', 'इस त्योहार कुछ ख़ास'],
    mr: ['सणाच्या शुभेच्छा', 'आनंद साजरा करूया', 'या सणाला काहीतरी खास'],
    hinglish: ['Tyohaar ki shubhkamnayein', 'Celebrate karo humare saath', 'Is tyohaar kuch khaas'],
  },
  opening: {
    en: ['Now open', 'Doors are open', "We're open"],
    hi: ['अब खुल गया है', 'शुभारंभ', 'आपका स्वागत है'],
    mr: ['आता सुरू!', 'शुभारंभ', 'तुमचे स्वागत आहे'],
    hinglish: ['Ab khul gaya hai', 'Grand opening', 'Aapka swagat hai'],
  },
  offer: {
    en: ['Something special for you', "Don't miss this", 'Treat yourself'],
    hi: ['आपके लिए कुछ ख़ास', 'मौका मत छोड़िए', 'ख़ुद को दीजिए तोहफ़ा'],
    mr: ['तुमच्यासाठी काहीतरी खास', 'संधी सोडू नका', 'स्वतःला भेट द्या'],
    hinglish: ['Aapke liye kuch khaas', 'Mauka mat chhodo', 'Treat yourself'],
  },
};

function defaultHeadline(ctx: RecipeContext): string {
  const list = HEADLINES[ctx.purpose]?.[ctx.language] ?? HEADLINES.promote.en;
  return list[0]!;
}

// ------------------------------------------------------------------------------- surprise (no key)
/** Small seeded random generator, so a seed always gives the same look. */
export function rng(seed: number) {
  let a = seed >>> 0 || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)]!;
  return { next, pick };
}

const PURPOSE_PIECES: Record<
  Purpose,
  { layouts: Layout[]; backgrounds: Background[]; badges: Badge[]; accents: Accent[] }
> = {
  promote: {
    layouts: ['spotlight', 'photo_band', 'editorial', 'arch', 'story'],
    backgrounds: ['orbs', 'gradient', 'photo_zoom', 'grid', 'rays'],
    badges: ['none', 'pill'],
    accents: [],
  },
  menu: {
    layouts: ['list', 'spotlight', 'editorial'],
    backgrounds: ['paper', 'gradient', 'grid'],
    badges: ['none', 'pill'],
    accents: [],
  },
  new_arrivals: {
    layouts: ['editorial', 'arch', 'photo_band', 'story'],
    backgrounds: ['gradient', 'orbs', 'photo_zoom'],
    badges: ['pill', 'tag'],
    accents: ['sparkles'],
  },
  festival: {
    layouts: ['arch', 'spotlight', 'story'],
    backgrounds: ['particles', 'rangoli', 'rays'],
    badges: ['ribbon', 'none'],
    accents: ['diyas', 'sparkles'],
  },
  opening: {
    layouts: ['photo_band', 'spotlight', 'story'],
    backgrounds: ['confetti', 'rays', 'photo_zoom'],
    badges: ['ribbon', 'stamp'],
    accents: ['sparkles'],
  },
  offer: {
    layouts: ['spotlight', 'editorial', 'arch', 'story'],
    backgrounds: ['gradient', 'neon_grid', 'confetti', 'orbs'],
    badges: ['starburst', 'stamp', 'ribbon', 'tag'],
    accents: ['sweep'],
  },
};

const NAMES = [
  'Warm Glow',
  'Fresh Morning',
  'Bold Street',
  'Soft Pastel',
  'Night Lights',
  'Classic Print',
  'Festive Gold',
  'Clean Studio',
  'Story Time',
  'Bright Pop',
];

/** A complete, varied recipe without any AI: rules by sector and purpose, random within them. */
export function surpriseRecipe(seed: number, ctx: RecipeContext): AdRecipe {
  const { pick, next } = rng(seed);
  const style = SECTOR_STYLE[ctx.sector] ?? SECTOR_STYLE.other;
  const pieces = PURPOSE_PIECES[ctx.purpose] ?? PURPOSE_PIECES.promote;
  const paletteName = pick(next() < 0.75 ? style.palettes : Object.keys(PRESET_PALETTES));
  const headlines = HEADLINES[ctx.purpose]?.[ctx.language] ?? HEADLINES.promote.en;
  const accents = [
    ...new Set([pick(style.accents), ...(pieces.accents.length ? [pick(pieces.accents)] : [])]),
  ];
  const raw = {
    name: pick(NAMES),
    layout: pick(pieces.layouts),
    background: pick(pieces.backgrounds),
    accents,
    badge: pick(pieces.badges),
    icon: style.icon,
    palette: PRESET_PALETTES[paletteName],
    fonts: pick(style.fonts),
    photo: {
      shape: pick(['arch', 'circle', 'rounded', 'polaroid', 'blob'] as PhotoShape[]),
      rotate: Math.round((next() * 8 - 4) * 10) / 10,
      scale: 0.95 + next() * 0.15,
      enter: pick(['rise', 'pop', 'iris', 'tilt', 'zoom', 'drop'] as Enter[]),
    },
    headline: {
      text: pick(headlines),
      accent: null,
      size: 0.95 + next() * 0.25,
      align: pick(['left', 'center'] as const),
      upper: style.fonts.includes('bold') && next() < 0.5,
      enter: pick(['rise', 'unmask', 'wipe', 'pop', 'slide_left', 'blur'] as Enter[]),
    },
    tagline: null,
    chips: (ctx.specialities ?? []).slice(0, 3),
    cta: null,
    rhythm: pick(RHYTHMS),
    duration: 10,
  };
  return checkRecipe(raw, ctx);
}
