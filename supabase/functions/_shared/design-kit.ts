// The AI art director's vocabulary: the pieces it may combine, the JSON schema it must answer
// in, its instructions, and a first word filter. The website's Composer (packages/
// styles-engine/src/composer/recipe.ts) checks every recipe again, fully, before drawing it;
// a unit test keeps these lists equal to the engine's. No Deno APIs here (tests load it).

export const LAYOUTS = ['spotlight', 'photo_band', 'editorial', 'arch', 'list', 'story'];
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
];
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
];
export const ACCENTS = [
  'steam',
  'sparkles',
  'diyas',
  'sweep',
  'marquee',
  'ring',
  'pulse_line',
  'icon',
];
export const BADGES = ['none', 'ribbon', 'stamp', 'starburst', 'tag', 'pill'];
export const PHOTO_SHAPES = ['arch', 'circle', 'rounded', 'polaroid', 'full', 'blob', 'none'];
export const FONT_PAIRS = ['modern', 'editorial', 'bold', 'friendly', 'elegant', 'handwritten'];
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
];
export const RHYTHMS = ['calm', 'lively', 'punchy'];

const str = (description: string) => ({ type: 'string', description });
const nullableStr = (description: string) => ({ type: ['string', 'null'], description });
const en = (list: string[]) => ({ type: 'string', enum: list });
const hex = (description: string) => ({ type: 'string', description: `${description}, #rrggbb` });

const RECIPE = {
  type: 'object',
  additionalProperties: false,
  required: [
    'name',
    'layout',
    'background',
    'accents',
    'badge',
    'icon',
    'palette',
    'fonts',
    'photo',
    'headline',
    'tagline',
    'chips',
    'cta',
    'rhythm',
    'duration',
  ],
  properties: {
    name: str('2-3 word name for this look, English, e.g. "Warm Glow"'),
    layout: en(LAYOUTS),
    background: en(BACKGROUNDS),
    accents: { type: 'array', items: en(ACCENTS), description: '0 to 3 accents' },
    badge: en(BADGES),
    icon: { anyOf: [en(ICONS), { type: 'null' }] },
    palette: {
      type: 'object',
      additionalProperties: false,
      required: ['bg', 'bg2', 'ink', 'accent', 'onAccent'],
      properties: {
        bg: hex('background'),
        bg2: hex('second background colour for the gradient'),
        ink: hex('text colour, must read clearly on both backgrounds'),
        accent: hex('accent for highlights and the button'),
        onAccent: hex('text colour on the accent'),
      },
    },
    fonts: en(FONT_PAIRS),
    photo: {
      type: 'object',
      additionalProperties: false,
      required: ['shape', 'rotate', 'scale', 'enter'],
      properties: {
        shape: en(PHOTO_SHAPES),
        rotate: { type: 'number', description: 'degrees, -8 to 8' },
        scale: { type: 'number', description: '0.8 to 1.2' },
        enter: en(ENTERS),
      },
    },
    headline: {
      type: 'object',
      additionalProperties: false,
      required: ['text', 'accent', 'size', 'align', 'upper', 'enter'],
      properties: {
        text: str('main line, at most 40 characters, in the ad language'),
        accent: nullableStr('optional second line in the accent colour, at most 30 characters'),
        size: { type: 'number', description: '0.8 to 1.3' },
        align: en(['left', 'center']),
        upper: { type: 'boolean' },
        enter: en(ENTERS),
      },
    },
    tagline: nullableStr('one short line, at most 70 characters, in the ad language'),
    chips: {
      type: 'array',
      items: { type: 'string' },
      description: "0 to 4, ONLY copied exactly from the owner's specialities",
    },
    cta: nullableStr(
      'button words, at most 28 characters, in the ad language; null for the standard button',
    ),
    rhythm: en(RHYTHMS),
    duration: { type: 'integer', enum: [10, 15] },
  },
};

export const DESIGN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['designs'],
  properties: { designs: { type: 'array', items: RECIPE } },
};

export type DesignBrief = {
  sector: string;
  purpose: string;
  language: 'en' | 'hi' | 'mr' | 'hinglish';
  businessName: string;
  description: string | null;
  productName: string | null;
  productDescription: string | null;
  specialities: string[];
  brandColors: string[];
  hasPhoto: boolean;
  hasOffer: boolean;
  hasPrice: boolean;
  /** Looks already shown, so new ones differ. */
  avoid: string[];
};

const LANGUAGE: Record<DesignBrief['language'], string> = {
  en: 'English',
  hi: 'Hindi in Devanagari script',
  mr: 'Marathi in Devanagari script',
  hinglish: 'Hinglish (Hindi in Latin letters mixed with English)',
};

const PURPOSE: Record<string, string> = {
  promote: 'promote the business itself: the place, what it is known for, why people should come',
  menu: 'show the menu or product range',
  new_arrivals: 'announce new products or a new collection',
  festival: 'send festival greetings from the business',
  opening: 'announce a grand opening',
  offer: 'announce an offer (the offer text is added by the app)',
};

const HEALTH = ['clinic', 'pharmacy', 'diagnostics'];

export function designInstructions(b: DesignBrief, count: number): string {
  return [
    `You are the art director of Kalpix, designing short animated vertical video ads for an Indian ${b.sector.replace('_', ' ')} business.`,
    `Create ${count} designs that look clearly DIFFERENT from each other: different layout, background, colour mood, fonts and motion. Make them attractive, modern and tasteful, like a good designer's work, not generic.`,
    `Ad purpose: ${PURPOSE[b.purpose] ?? PURPOSE.promote}.`,
    `Write all ad words in ${LANGUAGE[b.language]}. Keep them short, warm and local.`,
    '',
    'Hard rules:',
    '- NEVER write numbers, prices, discounts, percentages, dates, times, phone numbers or addresses. The app adds those from confirmed details.',
    '- Do not invent facts or promises (no "free", "best in town", "No. 1", "since ...").',
    "- chips: only words copied exactly from the owner's specialities list, or an empty list.",
    '- Colours: choose any colours, but ink must read clearly on bg and bg2, and onAccent on accent.',
    b.hasPhoto
      ? '- There is a product or shop photo: use a photo shape (not "none"); photo_band and story layouts suit strong photos.'
      : '- There is NO photo: use photo shape "none", and do not use photo_band, story or photo_zoom.',
    b.hasOffer
      ? '- There is an offer: choose a badge other than "none" in at least two designs.'
      : '- There is no offer: prefer badge "none" or "pill".',
    HEALTH.includes(b.sector)
      ? '- Healthcare: calm, trustworthy and clean. No claims of cure, results, guarantees, "best" or superlatives, no fear. Only describe services and care.'
      : '',
    b.sector === 'real_estate'
      ? '- Real estate: premium and calm; the RERA number is added by the app.'
      : '',
    b.avoid.length ? `- Already shown looks (make new ones different): ${b.avoid.join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function designFacts(b: DesignBrief): string {
  return JSON.stringify({
    business_name: b.businessName,
    about: b.description,
    product: b.productName,
    product_about: b.productDescription,
    specialities: b.specialities,
    brand_colours: b.brandColors,
    has_photo: b.hasPhoto,
    has_offer: b.hasOffer,
    has_price: b.hasPrice,
  });
}

/** First filter on the server: no numbers or money words in any AI-written text. */
const FACTY = /[0-9०-९₹%$]|\bRs\.?\b|\bINR\b|रुपये|रुपए|टक्के|प्रतिशत|percent/i;

export function scrubDesign(d: Record<string, unknown>, own: string[]): Record<string, unknown> {
  const clean = (v: unknown) => {
    if (typeof v !== 'string') return null;
    let rest = v;
    for (const o of own) if (o) rest = rest.split(o).join('');
    return FACTY.test(rest) ? null : v;
  };
  const h = (d.headline ?? {}) as Record<string, unknown>;
  return {
    ...d,
    headline: { ...h, text: clean(h.text), accent: clean(h.accent) },
    tagline: clean(d.tagline),
    cta: clean(d.cta),
  };
}
