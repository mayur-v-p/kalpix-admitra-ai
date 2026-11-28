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
    'why',
    'picture',
  ],
  properties: {
    picture: nullableStr(
      'id of the picture this design uses, copied exactly from the "pictures" list; null for the main photo',
    ),
    why: str(
      'one short sentence in simple English for the owner: why this design suits their business (and photo), at most 110 characters',
    ),
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

const PHOTO_READING = {
  type: 'object',
  additionalProperties: false,
  required: ['subject', 'colours', 'mood', 'sharp', 'good_light', 'tip'],
  properties: {
    subject: str('what the photo shows, one short plain-English sentence, at most 90 characters'),
    colours: {
      type: 'array',
      description: 'the 3 main colours of the photo',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'hex'],
        properties: { name: str('simple colour name, e.g. "Tea brown"'), hex: hex('the colour') },
      },
    },
    mood: { type: 'array', items: { type: 'string' }, description: '2 or 3 one-word moods' },
    sharp: { type: 'boolean', description: 'is the main subject sharp and in focus' },
    good_light: { type: 'boolean', description: 'is the photo bright enough and well lit' },
    tip: nullableStr(
      'one friendly tip to make the photo better for an ad, at most 110 characters; null if it is already good',
    ),
  },
};

export const DESIGN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['photo', 'designs'],
  properties: {
    photo: { anyOf: [PHOTO_READING, { type: 'null' }] },
    designs: { type: 'array', items: RECIPE },
  },
};

/** The AI edit: the changed design, what changed, and whether the owner asked to change a fact. */
export const EDIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['design', 'changes', 'facts_request'],
  properties: {
    design: RECIPE,
    changes: {
      type: 'array',
      description: '1 to 4 changes you made, for the owner to read',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'detail'],
        properties: {
          title: str('2-4 words, simple English, e.g. "Bigger photo"'),
          detail: str(
            'what you changed, one short simple-English sentence, at most 120 characters',
          ),
        },
      },
    },
    facts_request: {
      type: 'boolean',
      description:
        'true if the owner asked to change a price, discount, offer, date, time, phone or address',
    },
  },
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
  /** AI pictures of the product the owner ticked for ads (id + what it shows). */
  pictures?: { id: string; label: string | null; kind: string }[];
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

/** What a good ad designer knows, written once for every design and edit call. */
const CRAFT = [
  'How a good designer works:',
  '- One clear hero: the photo OR the headline, never both fighting. Leave space around it.',
  '- A phone ad is seen for 2 seconds: a headline of 2 to 5 words; the tagline is optional and short.',
  '- Colour: build the palette from the photo (pick one of its colours as the accent) or from the brand colours. One strong accent and calm backgrounds. No muddy mixes; neon only for young, loud businesses.',
  '- Fonts: elegant or editorial for boutiques, jewellery, salons and real estate; bold for gyms, sales and street food; friendly for cafes, sweets and schools; modern for clinics, tech and services. Handwritten only for short, warm lines.',
  '- Motion: calm for health, real estate and boutiques; lively for cafes, food and events; punchy for gyms and sales. Festival accents (diyas, rangoli, confetti) only for festivals and openings.',
  '- Good examples. Cafe with a warm cup photo: cream background, coffee-brown ink, clay accent, arch photo, friendly fonts, steam accent, calm. Gym: near-black background, lime accent, bold upper-case headline, full photo, punchy. Clinic: white to soft mint, deep green ink, rounded photo, modern fonts, no badge, calm.',
].join('\n');

const RULES = (b: DesignBrief) => [
  'Hard rules:',
  '- NEVER write numbers, prices, discounts, percentages, dates, times, phone numbers or addresses. The app adds those from confirmed details.',
  '- Do not invent facts or promises (no "free", "best in town", "No. 1", "since ...").',
  "- chips: only words copied exactly from the owner's specialities list, or an empty list.",
  '- Colours: choose any colours, but they must be readable: ink needs at least 4.5:1 contrast on BOTH bg and bg2, accent at least 3:1 on both (on light backgrounds use a deep accent, e.g. #9a4a1f not #e08b4a), and onAccent at least 4.5:1 on accent.',
  b.hasPhoto
    ? '- There is a product or shop photo: use a photo shape (not "none").'
    : '- There is NO photo: use photo shape "none", and do not use photo_band, story or photo_zoom.',
  HEALTH.includes(b.sector)
    ? '- Healthcare: calm, trustworthy and clean. No claims of cure, results, guarantees, "best" or superlatives, no fear. Only describe services and care.'
    : '',
];

/** Instructions for changing one design the way the owner asked. */
export function editInstructions(b: DesignBrief): string {
  return [
    `You are the art director of Kalpix. The owner of an Indian ${b.sector.replace('_', ' ')} business wants to change their animated vertical video ad.`,
    'You get the current design and what the owner asked (any language, often Hindi or Hinglish). Return the whole design with ONLY the asked change made; keep everything else the same, including the name.',
    `Ad words stay in ${LANGUAGE[b.language]}.`,
    'If the owner asks to change a price, discount, offer, date, time, phone or address: set facts_request to true and return the design unchanged with an empty changes list. You cannot change facts.',
    'If the request is unclear, make the most likely small change and say so in the change detail.',
    '',
    CRAFT,
    '',
    ...RULES(b),
  ]
    .filter(Boolean)
    .join('\n');
}

export function designInstructions(b: DesignBrief, count: number): string {
  return [
    `You are the art director of Kalpix, designing short animated vertical video ads for an Indian ${b.sector.replace('_', ' ')} business.`,
    `Create ${count} designs that look clearly DIFFERENT from each other: different layout, background, colour mood, fonts and motion. Make them attractive, modern and tasteful, like a good designer's work, not generic.`,
    count >= 3
      ? 'Vary the colour mood across the set: at least two DARK designs (deep background, light text) and at least two LIGHT ones; the photo colours guide the accents, not every background.'
      : '',
    `Ad purpose: ${PURPOSE[b.purpose] ?? PURPOSE.promote}.`,
    `Write all ad words in ${LANGUAGE[b.language]}. Keep them short, warm and local.`,
    'Each design also gets "why": one simple sentence telling the owner why it suits them.',
    '',
    CRAFT,
    '',
    b.hasPhoto
      ? 'The photo the ad will use is attached. Look at it first and fill "photo": what it shows, its 3 main colours, its mood, whether it is sharp and well lit, and one tip if it could be better. Then design FOR this photo: colours that suit it, a shape that frames it. photo_band and story layouts suit strong photos.'
      : 'There is no photo: set "photo" to null.',
    '',
    ...RULES(b),
    b.hasOffer
      ? '- There is an offer: choose a badge other than "none" in at least two designs.'
      : '- There is no offer: prefer badge "none" or "pill".',
    b.sector === 'real_estate'
      ? '- Real estate: premium and calm; the RERA number is added by the app.'
      : '',
    b.avoid.length ? `- Already shown looks (make new ones different): ${b.avoid.join(', ')}.` : '',
    b.pictures?.length
      ? '- "pictures" lists more pictures of the product. Give each design a different picture where you can (null = the main photo), and choose layouts and colours that suit that picture.'
      : '- Set "picture" to null.',
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
    pictures: (b.pictures ?? []).map((p) => ({
      id: p.id,
      shows: p.label,
      kind:
        p.kind === 'generated' ? 'AI picture made from the name' : 'AI scene with the real product',
    })),
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
    why: plain(d.why, 130),
  };
}

/** Plain text for the owner to read (not drawn on the ad): no control characters or tags. */
function plain(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v
    .replace(/[\u0000-\u001f\u007f<>{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s ? s.slice(0, max) : null;
}

export type PhotoReading = {
  subject: string | null;
  colours: { name: string; hex: string }[];
  mood: string[];
  sharp: boolean;
  goodLight: boolean;
  tip: string | null;
};

/** What the AI saw in the photo, checked: short plain text and real hex colours only. */
export function scrubPhoto(raw: unknown): PhotoReading | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const colours = (Array.isArray(r.colours) ? r.colours : [])
    .map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      const name = plain(o.name, 24);
      const hex = typeof o.hex === 'string' && /^#[0-9a-f]{6}$/i.test(o.hex) ? o.hex : null;
      return name && hex ? { name, hex: hex.toLowerCase() } : null;
    })
    .filter((c): c is { name: string; hex: string } => c !== null)
    .slice(0, 3);
  const mood = (Array.isArray(r.mood) ? r.mood : [])
    .map((m) => plain(m, 16))
    .filter((m): m is string => Boolean(m))
    .slice(0, 3);
  return {
    subject: plain(r.subject, 110),
    colours,
    mood,
    sharp: r.sharp !== false,
    goodLight: r.good_light !== false,
    tip: plain(r.tip, 130),
  };
}

export type DesignChange = { title: string; detail: string };

export function scrubChanges(raw: unknown): DesignChange[] {
  return (Array.isArray(raw) ? raw : [])
    .map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      const title = plain(o.title, 40);
      return title ? { title, detail: plain(o.detail, 140) ?? '' } : null;
    })
    .filter((c): c is DesignChange => c !== null)
    .slice(0, 4);
}
