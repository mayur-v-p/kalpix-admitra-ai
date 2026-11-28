// Scene ideas for AI product pictures (make-product-pictures). The language model writes three
// different settings for the product; the image model then makes one picture per idea. No Deno
// APIs here (unit tests load this file).

export type PictureIdea = { label: string; scene: string };
export type PictureBrief = {
  productName: string;
  productDescription: string | null;
  businessName: string;
  sector: string;
  /** The owner's own words about how the product looks (optional). */
  note: string | null;
  /** Does the owner's photo exist? Then the same product is placed in new scenes. */
  hasPhoto: boolean;
  /** Labels of pictures already made, so the new ones differ. */
  avoid: string[];
};

export const IDEAS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ideas'],
  properties: {
    ideas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'scene'],
        properties: {
          label: {
            type: 'string',
            description: '2 to 5 plain English words, e.g. "By the café window"',
          },
          scene: {
            type: 'string',
            description:
              'one sentence describing the setting, surface, props, light and camera angle; at most 300 characters',
          },
        },
      },
    },
  },
};

export function ideasInstructions(b: PictureBrief, count: number): string {
  return [
    `You are a food and product photographer planning ${count} advertising photos for an Indian ${b.sector.replace('_', ' ')} business.`,
    b.hasPhoto
      ? 'The owner has a photo of the product. Each idea places that SAME product in a new setting: describe only the setting, surface, props, light and angle, never change the product.'
      : 'There is no photo. Each idea is a realistic photo of the product as it is usually made and sold in India: describe how it looks and the setting.',
    `Make the ${count} ideas clearly different from each other: for example one close and simple, one in a real place (shop, café, home, clinic), one top-down or festive. Warm, tasteful, true to Indian life.`,
    'Never mention text, signs, prices, logos, brand names or people’s faces.',
    b.sector === 'clinic' || b.sector === 'pharmacy' || b.sector === 'diagnostics'
      ? 'Healthcare: calm, clean and honest. No before/after, no bodies, no medical claims.'
      : '',
    b.avoid.length ? `Already made (do something different): ${b.avoid.join('; ')}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function ideasFacts(b: PictureBrief): string {
  return JSON.stringify({
    product: b.productName,
    about: b.productDescription,
    owner_note: b.note,
    business: b.businessName,
    sector: b.sector,
  });
}

/** Ready-made ideas when the language model is not available. */
export function fallbackIdeas(hasPhoto: boolean): PictureIdea[] {
  return [
    {
      label: 'Simple and close',
      scene:
        'close-up on a clean warm neutral surface, soft daylight from the side, gentle shadow, shallow depth of field',
    },
    {
      label: hasPhoto ? 'In a real place' : 'In the shop',
      scene:
        'on a wooden table in a cosy Indian shop or café, warm morning light through a window, softly blurred background',
    },
    {
      label: 'Festive evening',
      scene:
        'on a dark table with a few glowing clay diyas and marigold flowers around, warm evening light, top-down three-quarter view',
    },
  ];
}

const plain = (v: unknown, max: number) =>
  typeof v === 'string'
    ? v
        .replace(/[\u0000-\u001f\u007f<>{}]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, max)
    : '';

/** Keeps good ideas only; fills the rest from the ready-made ones. */
export function checkIdeas(raw: unknown, count: number, hasPhoto: boolean): PictureIdea[] {
  const list = (raw as { ideas?: unknown[] } | null)?.ideas;
  const good = (Array.isArray(list) ? list : [])
    .map((i) => {
      const o = (i ?? {}) as Record<string, unknown>;
      return { label: plain(o.label, 40), scene: plain(o.scene, 300) };
    })
    .filter((i) => i.label && i.scene.length >= 10);
  const fill = fallbackIdeas(hasPhoto).filter((f) => !good.some((g) => g.label === f.label));
  return [...good, ...fill].slice(0, count);
}
