import { openaiConfigured, openaiJson } from './openai.ts';

// Ad-copy providers behind one interface (architecture.md 5.1). Choose with COPY_PROVIDER.
//   openai: writes drafts with OpenAI (needs OPENAI_API_KEY; the default when that key is set).
//   mock:   ready-made lines per goal and language. No account needed (default without a key).
//
// PRD rule: AI never invents or rewrites facts. The input deliberately has NO price, offer,
// dates, phone or address, and guardCopy() drops any suggestion that contains numbers,
// currency or percentages, so a made-up "50% OFF" can never reach an ad.

export type CopyInput = {
  businessName: string;
  productName: string | null;
  productDescription: string | null;
  industry: string;
  goal: 'sale' | 'new_product' | 'festival' | 'event' | 'booking' | 'visit';
  language: 'en' | 'hi' | 'mr' | 'hinglish';
  tone: string;
};

export type CopySuggestions = { headlines: string[]; captions: string[]; hashtags: string[] };

export interface Copywriter {
  readonly name: string;
  write(input: CopyInput): Promise<CopySuggestions>;
}

const pick = (list: string[], n: number) => list.slice(0, n);

const en: Record<CopyInput['goal'], (p: string, b: string) => string[]> = {
  sale: (p, b) => [
    `Your favourite ${p}, now even better`,
    `Treat yourself at ${b}`,
    `${p} is calling your name`,
  ],
  new_product: (p, b) => [`Say hello to ${p}`, `New at ${b}: ${p}`, `Just arrived, ${p}`],
  festival: (p, b) => [
    `Celebrate with ${p}`,
    `Festive moments at ${b}`,
    `Make this festival special`,
  ],
  event: (_p, b) => [`Join us at ${b}`, `Something special is happening`, `See you at ${b}`],
  booking: (p, b) => [`Book your ${p} today`, `Your slot is waiting`, `Reserve your spot at ${b}`],
  visit: (p, b) => [`Come visit ${b}`, `Stop by for ${p}`, `Your neighbourhood favourite`],
};

const headlinesByLanguage: Record<
  CopyInput['language'],
  (g: CopyInput['goal'], p: string, b: string) => string[]
> = {
  en: (g, p, b) => en[g](p, b),
  hi: (_g, p, b) => [`${p} का स्वाद, अब और भी ख़ास`, `${b} में आपका इंतज़ार है`, `आज ही आज़माएँ ${p}`],
  mr: (_g, p, b) => [`${p} ची ख़ास चव`, `${b} मध्ये तुमचे स्वागत`, `आजच अनुभवा ${p}`],
  hinglish: (_g, p, b) => [`${p} ka asli swaad`, `Aaj hi aao ${b}`, `Mood fresh, ${p} best`],
};

const captionsByLanguage: Record<CopyInput['language'], (p: string, b: string) => string[]> = {
  en: (p, b) => [
    `Made fresh at ${b}. Drop by today or message us to order your ${p}.`,
    `Good things are better shared. Tag a friend who needs ${p} today!`,
  ],
  hi: (p, b) => [
    `${b} में ताज़ा बना ${p}. आज ही आइए या मैसेज करके ऑर्डर करें.`,
    `अपने दोस्तों को टैग करें और साथ में ${p} का मज़ा लें!`,
  ],
  mr: (p, b) => [
    `${b} मध्ये ताज्या ${p} चा आनंद घ्या. आजच भेट द्या किंवा मेसेज करा.`,
    `मित्रांना टॅग करा आणि ${p} चा आनंद एकत्र घ्या!`,
  ],
  hinglish: (p, b) => [
    `${b} pe fresh ${p} ready hai. Aaj hi aao ya message karke order karo.`,
    `Apne dost ko tag karo jise ${p} chahiye!`,
  ],
};

const mock: Copywriter = {
  name: 'mock',
  async write(input) {
    const p = input.productName ?? input.businessName;
    const b = input.businessName;
    const tag = (s: string) => '#' + s.replace(/[^\p{L}\p{N}]/gu, '');
    const industryTags: Record<string, string[]> = {
      food: ['#foodie', '#freshfood'],
      retail: ['#shoplocal', '#newarrivals'],
      beauty: ['#selfcare', '#salon'],
    };
    return {
      headlines: pick(headlinesByLanguage[input.language](input.goal, p, b), 3),
      captions: pick(captionsByLanguage[input.language](p, b), 2),
      hashtags: [
        tag(b),
        ...(input.productName ? [tag(input.productName)] : []),
        ...(industryTags[input.industry] ?? []),
        '#shoplocal',
      ].filter((t, i, all) => t.length > 1 && all.indexOf(t) === i),
    };
  },
};

const LANGUAGE_NAMES: Record<CopyInput['language'], string> = {
  en: 'English',
  hi: 'Hindi in Devanagari script',
  mr: 'Marathi in Devanagari script',
  hinglish: 'Hinglish (Hindi in Latin letters, mixed with English)',
};

const COPY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headlines', 'captions', 'hashtags'],
  properties: {
    headlines: { type: 'array', items: { type: 'string' } },
    captions: { type: 'array', items: { type: 'string' } },
    hashtags: { type: 'array', items: { type: 'string' } },
  },
};

export function copyInstructions(input: CopyInput): string {
  return [
    'You write short ad text for an Indian small shop, for WhatsApp Status, Instagram Reels',
    'and posters.',
    `Write everything in ${LANGUAGE_NAMES[input.language]}.`,
    `Tone: ${input.tone}. Warm, local and simple, like the shop owner talking to customers.`,
    '',
    'Write:',
    '- 3 headlines, each at most 40 characters, no full stop at the end.',
    '- 2 captions, each 1 to 2 short sentences, inviting people to visit or message.',
    '- 5 hashtags, starting with #, letters and digits only, no spaces.',
    '',
    'Strict rules:',
    '- Do NOT write any price, discount, percentage, number, date, time, phone number or',
    '  address. The shop adds those itself from confirmed details. Words like "sale",',
    '  "offer" and "special" are fine.',
    '- Do not promise anything the shop did not say (no "free", "best in city", "guaranteed").',
    '- Use only the facts below.',
  ].join('\n');
}

const openai: Copywriter = {
  name: 'openai',
  async write(input) {
    const facts = {
      shop: input.businessName,
      product: input.productName,
      product_description: input.productDescription,
      business_type: input.industry,
      ad_goal: input.goal,
    };
    return await openaiJson<CopySuggestions>({
      name: 'ad_copy',
      schema: COPY_SCHEMA,
      system: copyInstructions(input),
      user: JSON.stringify(facts),
      timeoutMs: 15000,
      temperature: 0.8,
    });
  },
};

const providers: Record<string, Copywriter> = { mock, openai };

/** Ready-made drafts, used when the AI provider fails. */
export const fallbackCopywriter: Copywriter = mock;

export function getCopywriter(): Copywriter {
  const name = Deno.env.get('COPY_PROVIDER') || (openaiConfigured() ? 'openai' : 'mock');
  const provider = providers[name];
  if (!provider) throw new Error(`Unknown COPY_PROVIDER "${name}"`);
  return provider;
}

/**
 * Drops suggestions that contain numbers, currency or percentages (Latin or Devanagari
 * digits), except numbers that are part of the owner's own business or product name.
 * Trims and caps lengths to the database limits.
 */
export function guardCopy(
  s: CopySuggestions,
  input: Pick<CopyInput, 'businessName' | 'productName'>,
): CopySuggestions {
  const ownNumbers = new Set(
    `${input.businessName} ${input.productName ?? ''}`.match(/[0-9०-९]+/g) ?? [],
  );
  const safe = (text: string) => {
    if (/[₹%$]|\bRs\.?|\bINR\b|रु|रुपये|रुपए/i.test(text)) return false;
    const numbers = text.match(/[0-9०-९]+/g) ?? [];
    return numbers.every((n) => ownNumbers.has(n));
  };
  const clean = (list: string[], max: number) =>
    list
      .map((t) => t.trim().replace(/\s+/g, ' '))
      .filter((t) => t.length > 0 && t.length <= max && safe(t));
  return {
    headlines: clean(s.headlines, 80).slice(0, 5),
    captions: clean(s.captions, 600).slice(0, 3),
    hashtags: s.hashtags.filter((h) => /^#[\p{L}\p{N}_]{1,40}$/u.test(h) && safe(h)).slice(0, 15),
  };
}
