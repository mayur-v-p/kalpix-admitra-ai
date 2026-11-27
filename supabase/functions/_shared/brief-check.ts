// "Understand what the owner said" with an LLM: the JSON schema it must answer in, the
// instructions, and checkBrief(), which checks every value before the website sees it.
//
// PRD rule: AI never invents facts. The model is told to leave out anything not said, and
// whatever it returns is still shown on "Check your ad", editable, read back and confirmed by
// the owner before it can appear on an ad. This file has no Deno APIs, so the unit tests load
// it directly.

export const GOALS = ['sale', 'new_product', 'festival', 'event', 'booking', 'visit'] as const;
export const CTAS = ['whatsapp', 'call', 'visit', 'book', 'order'] as const;
export const LANGUAGES = ['en', 'hi', 'mr', 'hinglish'] as const;
export const BUSINESS_TYPES = ['food', 'retail', 'beauty'] as const;

/** What the model answers (every key present; null when not said). */
export type RawBrief = {
  product: string | null;
  price: number | null;
  discount_percent: number | null;
  start_date: string | null;
  end_date: string | null;
  start_hour: number | null;
  end_hour: number | null;
  goal: string;
  occasion: string | null;
  cta: string | null;
  language: string | null;
  business_type: string | null;
};

/** Same shape as the website's VoiceBrief (apps/web/src/features/voice/parse.ts). */
export type CheckedBrief = {
  product?: string;
  price?: number;
  discount?: number;
  from?: string;
  to?: string;
  time?: string;
  goal?: (typeof GOALS)[number];
  occasion?: string;
  cta?: (typeof CTAS)[number];
  language?: (typeof LANGUAGES)[number];
  businessType?: (typeof BUSINESS_TYPES)[number];
};

const nullable = (type: string, extra: Record<string, unknown> = {}) => ({
  type: [type, 'null'],
  ...extra,
});

export const BRIEF_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'product',
    'price',
    'discount_percent',
    'start_date',
    'end_date',
    'start_hour',
    'end_hour',
    'goal',
    'occasion',
    'cta',
    'language',
    'business_type',
  ],
  properties: {
    product: nullable('string', { description: 'Short product name, or null' }),
    price: nullable('number', { description: 'Price in rupees before any discount, or null' }),
    discount_percent: nullable('number', { description: 'Discount in percent, or null' }),
    start_date: nullable('string', { description: 'YYYY-MM-DD, or null' }),
    end_date: nullable('string', { description: 'YYYY-MM-DD, or null' }),
    start_hour: nullable('integer', { description: '0-23, or null' }),
    end_hour: nullable('integer', { description: '0-23, or null' }),
    goal: { type: 'string', enum: [...GOALS] },
    occasion: nullable('string', { description: 'Festival or occasion name in English, or null' }),
    cta: { anyOf: [{ type: 'string', enum: [...CTAS] }, { type: 'null' }] },
    language: { anyOf: [{ type: 'string', enum: [...LANGUAGES] }, { type: 'null' }] },
    business_type: { anyOf: [{ type: 'string', enum: [...BUSINESS_TYPES] }, { type: 'null' }] },
  },
} as const;

export function briefInstructions(today: string, products: string[]): string {
  return [
    'You read what an Indian shop owner said (Hindi, Marathi, Hinglish or English, often',
    'from speech recognition, so expect spelling mistakes) about an ad they want, and fill',
    'in the ad details.',
    '',
    'Rules:',
    '- Only use what the owner actually said. If something was not said, answer null.',
    '  Never guess or invent a price, discount, date or time.',
    '- Numbers can be words: "pandrah sau" = 1500, "dedh hazaar" = 1500, "dhai sau" = 250,',
    '  "sawa sau" = 125, "पंधराशे" = 1500, "बीस" = 20, "do hazaar" = 2000.',
    '- price: the normal price in rupees, before the discount.',
    '- discount_percent: only a percentage discount (1 to 90). A rupee amount off is not a',
    '  percentage: answer null for it.',
    `- Today is ${today} (India). Dates without a year mean the next time that date comes.`,
    '  "15 se 20 November tak" = start 15 Nov, end 20 Nov. "aaj" = today, "kal" = tomorrow.',
    '- start_hour/end_hour in 24-hour time: "shaam 5 se 9 baje" = 17 and 21; "subah 10 se',
    '  1 baje tak" = 10 and 13.',
    '- goal: festival when a festival is named (Diwali, Holi, Eid, Navratri, Ganesh',
    '  Chaturthi, Christmas, Pongal, Onam, ...); otherwise sale for discounts or offers,',
    '  new_product for something new, event, booking for appointments, visit to invite',
    '  people to the shop. Default sale.',
    '- occasion: the festival or occasion name in English ("Diwali"), or null.',
    '- product: short name in English Title Case ("Saree", "Masala Chai").',
    products.length
      ? `  If it is one of the owner's products, use exactly that name: ${products.map((p) => JSON.stringify(p)).join(', ')}.`
      : '  The owner has no saved products yet.',
    '- cta: the button the owner asked for (WhatsApp, call, visit, book, order), or null.',
    '- language: only when the owner asks for the ad in a language ("English mein banao" =',
    '  en, "Marathi madhe" = mr), otherwise null.',
    '- business_type: food (cafe, restaurant, sweets), retail (clothes, shop), beauty',
    '  (salon, parlour), or null.',
  ].join('\n');
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86_400_000;

function checkDate(v: unknown, today: string): string | undefined {
  if (typeof v !== 'string' || !DATE.test(v)) return undefined;
  const t = Date.parse(v + 'T00:00:00Z');
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== v) return undefined;
  const now = Date.parse(today + 'T00:00:00Z');
  // A week back (ongoing offers) to a year ahead.
  if (t < now - 7 * DAY || t > now + 366 * DAY) return undefined;
  return v;
}

const hour = (v: unknown) =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 23 ? v : undefined;

/** 17, 21 -> "5–9 PM"; 10, 13 -> "10 AM – 1 PM" (same style as the website's parser). */
export function timeText(start: number, end: number): string {
  const h12 = (h: number) => (h % 12 === 0 ? 12 : h % 12);
  const pm = (h: number) => h >= 12;
  if (pm(start) === pm(end)) return `${h12(start)}–${h12(end)} ${pm(start) ? 'PM' : 'AM'}`;
  return `${h12(start)} ${pm(start) ? 'PM' : 'AM'} – ${h12(end)} ${pm(end) ? 'PM' : 'AM'}`;
}

const oneOf = <T extends string>(list: readonly T[], v: unknown): T | undefined =>
  list.includes(v as T) ? (v as T) : undefined;

const shortText = (v: unknown, max: number) => {
  if (typeof v !== 'string') return undefined;
  const s = v.replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim();
  return s && s.length <= max ? s : undefined;
};

/** Keeps only values that pass the checks; anything doubtful is left for the owner to fill. */
export function checkBrief(raw: unknown, today: string): CheckedBrief {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Partial<RawBrief>;
  const out: CheckedBrief = {};

  const product = shortText(r.product, 60);
  if (product && !/\d/.test(product)) out.product = product;

  if (typeof r.price === 'number' && Number.isFinite(r.price) && r.price >= 1 && r.price <= 10_000_000)
    out.price = Math.round(r.price * 100) / 100;

  if (
    typeof r.discount_percent === 'number' &&
    Number.isFinite(r.discount_percent) &&
    r.discount_percent >= 1 &&
    r.discount_percent <= 90
  )
    out.discount = Math.round(r.discount_percent);

  let from = checkDate(r.start_date, today);
  let to = checkDate(r.end_date, today);
  if (from && to && from > to) [from, to] = [to, from];
  if (from) out.from = from;
  if (to) out.to = to;

  const a = hour(r.start_hour);
  const b = hour(r.end_hour);
  if (a !== undefined && b !== undefined && a < b) out.time = timeText(a, b);

  out.goal = oneOf(GOALS, r.goal) ?? 'sale';
  const occasion = shortText(r.occasion, 30);
  if (occasion && !/\d/.test(occasion)) out.occasion = occasion;
  const cta = oneOf(CTAS, r.cta);
  if (cta) out.cta = cta;
  const language = oneOf(LANGUAGES, r.language);
  if (language) out.language = language;
  const businessType = oneOf(BUSINESS_TYPES, r.business_type);
  if (businessType) out.businessType = businessType;
  return out;
}

/** Today's date in India, YYYY-MM-DD. */
export function indiaToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
}
