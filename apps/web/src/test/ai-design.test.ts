import {
  checkRecipe,
  likeness,
  photoFit,
  pickBest,
  readability,
  scoreLook,
  surpriseRecipe,
  type AdRecipe,
  type RecipeContext,
} from '@admitra/styles-engine';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { basicEdit, editDesign, quickEditFor, sameLook } from '@/features/design/ai-edit';
import { checkPhotoReading, designLooks, DESIGNS_MADE } from '@/features/design/api';
import { supabaseMock } from './supabase-mock';

const cafe: RecipeContext = {
  sector: 'cafe',
  purpose: 'promote',
  language: 'hinglish',
  businessName: 'Kesar Chai House',
  productName: 'Masala Chai',
  specialities: ['Masala chai'],
  hasPhoto: true,
};
const base = surpriseRecipe(7, cafe);
const look = (over: Partial<AdRecipe> & Record<string, unknown>) => ({ ...base, ...over });
const warm = {
  bg: '#f6ead8',
  bg2: '#efdcc0',
  ink: '#3b2414',
  accent: '#b4572f',
  onAccent: '#ffffff',
};
const night = {
  bg: '#10163f',
  bg2: '#1b2a63',
  ink: '#ffffff',
  accent: '#f5b83d',
  onAccent: '#10163f',
};
const mint = {
  bg: '#dcf3ea',
  bg2: '#c7ebdc',
  ink: '#0f3b2e',
  accent: '#1f7a5a',
  onAccent: '#ffffff',
};
const photoColours = ['#7a4a2a', '#f3e3c8', '#c0643a'];

const invoke = vi.fn();
beforeEach(() => {
  invoke.mockReset();
  (supabaseMock as Record<string, unknown>).functions = { invoke };
});

describe('scoring designs', () => {
  it('reads short headlines as easier than long ones', () => {
    const short = checkRecipe(look({ headline: { ...base.headline, text: 'Pehli chuski' } }), cafe);
    const long = checkRecipe(
      look({ headline: { ...base.headline, text: 'Subah ki pehli chuski ka asli mazaa' } }),
      cafe,
    );
    expect(readability(short)).toBeGreaterThan(readability(long));
  });

  it('prefers colours from the photo over clashing ones', () => {
    const suits = checkRecipe(look({ palette: warm }), cafe);
    const clash = checkRecipe(
      look({
        palette: {
          bg: '#2fd3ff',
          bg2: '#25c0ee',
          ink: '#08101a',
          accent: '#7a2fff',
          onAccent: '#ffffff',
        },
      }),
      cafe,
    );
    expect(photoFit(suits, photoColours)!).toBeGreaterThan(photoFit(clash, photoColours)!);
    expect(photoFit(suits, [])).toBeNull();
  });

  it('marks designs whose colours had to be fixed to be readable', () => {
    const bad = scoreLook(
      look({
        palette: {
          bg: '#ffffff',
          bg2: '#f4f4f4',
          ink: '#eeeeee',
          accent: '#fafafa',
          onAccent: '#ffffff',
        },
      }),
      cafe,
    );
    const good = scoreLook(look({ palette: night }), cafe);
    expect(bad.score.fixedColours).toBe(true);
    expect(good.score.fixedColours).toBe(false);
    expect(good.score.contrast).toBeGreaterThan(bad.score.contrast);
    expect(good.score.contrastText).toMatch(/^\d+(\.\d)?:1$/);
  });

  it('keeps the best three that differ, and says why the others were hidden', () => {
    const raws = [
      look({
        name: 'Warm A',
        layout: 'spotlight',
        palette: warm,
        why: 'Uses the cream of your photo.',
      }),
      look({ name: 'Warm B', layout: 'spotlight', palette: warm }),
      look({ name: 'Night', layout: 'photo_band', palette: night, fonts: 'bold' }),
      look({ name: 'Mint', layout: 'editorial', palette: mint, fonts: 'editorial' }),
      look({ name: 'Warm C', layout: 'spotlight', palette: warm }),
      look({
        name: 'Tiny',
        layout: 'arch',
        fonts: 'handwritten',
        headline: { ...base.headline, text: 'Ek garam cup jo aapka din bana de', size: 0.8 },
      }),
    ];
    const { shown, hidden } = pickBest(raws, cafe, photoColours);
    expect(shown).toHaveLength(3);
    expect(hidden).toHaveLength(3);
    expect(new Set(shown.map((s) => s.recipe.layout)).size).toBe(3);
    expect(shown.find((s) => s.recipe.name === 'Warm A')?.why).toBe(
      'Uses the cream of your photo.',
    );
    expect(hidden.some((h) => /Too much like/.test(h.hiddenReason!))).toBe(true);
    expect(hidden.every((h) => h.hiddenReason)).toBe(true);
    expect(likeness(raws[0] as AdRecipe, raws[1] as AdRecipe)).toBeGreaterThanOrEqual(55);
  });
});

describe('designing six looks', () => {
  it('scores the AI designs and keeps the photo reading', async () => {
    invoke.mockResolvedValue({
      data: {
        designs: [1, 2, 3, 4, 5, 6].map((i) => surpriseRecipe(i * 31, cafe)),
        photo: {
          subject: 'A glass of masala chai',
          colours: [
            { name: 'Tea brown', hex: '#7A4A2A' },
            { name: 'Bad', hex: 'url(x)' },
          ],
          mood: ['Warm', 'Homely'],
          sharp: true,
          goodLight: false,
          tip: null,
        },
      },
      error: null,
    });
    const looks = await designLooks('c1', cafe, []);
    expect(invoke).toHaveBeenCalledWith('design-ad', {
      body: { campaignId: 'c1', count: DESIGNS_MADE, avoid: [] },
    });
    expect(looks.source).toBe('ai');
    expect(looks.shown).toHaveLength(3);
    expect(looks.hidden).toHaveLength(3);
    expect(looks.photo?.colours).toEqual([{ name: 'Tea brown', hex: '#7a4a2a' }]);
    expect(looks.photo?.goodLight).toBe(false);
    expect(looks.shown[0]!.score.fit).not.toBeNull();
  });

  it('falls back to six surprise designs without AI', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('not_configured') });
    const looks = await designLooks('c1', cafe, []);
    expect(looks.source).toBe('surprise');
    expect(looks.shown.length + looks.hidden.length).toBe(DESIGNS_MADE);
    expect(looks.photo).toBeNull();
  });

  it('ignores a broken photo reading', () => {
    expect(checkPhotoReading('nope')).toBeNull();
    expect(
      checkPhotoReading({ mood: ['<b>x</b>'.repeat(10)] })?.mood[0]?.length,
    ).toBeLessThanOrEqual(16);
  });
});

describe('changing a design', () => {
  const r = checkRecipe(
    look({
      palette: warm,
      headline: { ...base.headline, text: 'Subah ki pehli chuski', accent: null },
    }),
    cafe,
  );

  it('understands suggestion words in Hindi, Hinglish and English', () => {
    expect(quickEditFor('thoda festive banao')).toBe('festive');
    expect(quickEditFor('photo bada karo')).toBe('photo');
    expect(quickEditFor('headline chhota karo')).toBe('short');
    expect(quickEditFor('use my brand colours')).toBe('brand');
    expect(quickEditFor('kuch aur')).toBeNull();
  });

  it('makes the simple edits without AI', () => {
    const festive = basicEdit('festive', r, cafe, []);
    expect(festive.kind === 'done' && festive.recipe.background).toBe('rangoli');
    const photo = basicEdit('photo', r, cafe, []);
    expect(photo.kind === 'done' && photo.recipe.photo.scale).toBeGreaterThan(r.photo.scale);
    const short = basicEdit('short', r, cafe, []);
    expect(short.kind === 'done' && short.recipe.headline.text).toBe('Subah ki pehli');
    const calm = basicEdit('calm', r, cafe, []);
    expect(calm.kind === 'done' && calm.recipe.rhythm).toBe('calm');
    expect(basicEdit('brand', r, cafe, []).kind).toBe('none');
    const brand = basicEdit('brand', r, cafe, ['#0b1033', '#ffffff', '#3f7bff']);
    expect(brand.kind === 'done' && brand.recipe.palette.bg).toBe('#0b1033');
  });

  it('uses the AI answer, checked again', async () => {
    invoke.mockResolvedValue({
      data: {
        factsRequest: false,
        design: { ...r, rhythm: 'punchy', tagline: 'Sirf ₹20 mein' },
        changes: [{ title: 'More energy', detail: 'Faster movement.' }],
      },
      error: null,
    });
    const out = await editDesign({
      campaignId: 'c1',
      recipe: r,
      request: 'zyada josh',
      ctx: cafe,
      brandColors: [],
    });
    expect(out.kind).toBe('done');
    if (out.kind !== 'done') return;
    expect(out.source).toBe('ai');
    expect(out.recipe.rhythm).toBe('punchy');
    // A price slipped into the words is dropped by the checker.
    expect(out.recipe.tagline).toBeNull();
    expect(out.changes[0]!.title).toBe('More energy');
  });

  it('never changes facts', async () => {
    invoke.mockResolvedValue({
      data: { factsRequest: true, design: null, changes: [] },
      error: null,
    });
    const ai = await editDesign({
      campaignId: 'c1',
      recipe: r,
      request: 'price 30 karo',
      ctx: cafe,
      brandColors: [],
    });
    expect(ai.kind).toBe('facts');
    invoke.mockResolvedValue({ data: null, error: new Error('not_configured') });
    const noAi = await editDesign({
      campaignId: 'c1',
      recipe: r,
      request: 'discount 20 percent',
      ctx: cafe,
      brandColors: [],
    });
    expect(noAi.kind).toBe('facts');
  });

  it('falls back to the simple edit when AI is not available', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('not_configured') });
    const out = await editDesign({
      campaignId: 'c1',
      recipe: r,
      request: 'Make it more festive',
      ctx: cafe,
      brandColors: [],
      quick: 'festive',
    });
    expect(out.kind === 'done' && out.source).toBe('basic');
    const unknown = await editDesign({
      campaignId: 'c1',
      recipe: r,
      request: 'kuch aur',
      ctx: cafe,
      brandColors: [],
    });
    expect(unknown.kind).toBe('none');
  });

  it('sees the same look even when keys come back reordered', () => {
    const reordered = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(r).reverse())));
    expect(sameLook(r, reordered)).toBe(true);
    expect(sameLook(r, { ...r, rhythm: 'punchy' })).toBe(false);
  });
});

describe('the server’s edit and photo checks', async () => {
  const path = '@supabase-functions/_shared/design-kit.ts';
  const kit = (await import(/* @vite-ignore */ path)) as {
    DESIGN_SCHEMA: {
      required: string[];
      properties: { designs: { items: { required: string[] } } };
    };
    EDIT_SCHEMA: { required: string[] };
    scrubPhoto: (raw: unknown) => { colours: unknown[]; tip: string | null } | null;
    scrubChanges: (raw: unknown) => { title: string; detail: string }[];
    scrubDesign: (d: Record<string, unknown>, own: string[]) => Record<string, unknown>;
    editInstructions: (b: Record<string, unknown>) => string;
  };

  it('asks for the photo reading and a reason for every design', () => {
    expect(kit.DESIGN_SCHEMA.required).toContain('photo');
    expect(kit.DESIGN_SCHEMA.properties.designs.items.required).toContain('why');
    expect(kit.EDIT_SCHEMA.required).toEqual(['design', 'changes', 'facts_request']);
  });

  it('cleans what the AI says about the photo and its changes', () => {
    const photo = kit.scrubPhoto({
      subject: 'Chai',
      colours: [
        { name: 'Brown', hex: '#7a4a2a' },
        { name: 'x', hex: 'red' },
      ],
      mood: ['Warm'],
      sharp: true,
      good_light: true,
      tip: '<script>hi</script>',
    });
    expect(photo?.colours).toHaveLength(1);
    expect(photo?.tip).toBe('scripthi/script');
    expect(kit.scrubPhoto(null)).toBeNull();
    expect(kit.scrubChanges([{ title: 'A', detail: 'B' }, { detail: 'no title' }, 'x'])).toEqual([
      { title: 'A', detail: 'B' },
    ]);
    expect(kit.scrubDesign({ headline: {}, why: 'Suits your photo' }, []).why).toBe(
      'Suits your photo',
    );
  });

  it('tells the editor to change only what was asked and never facts', () => {
    const text = kit.editInstructions({
      sector: 'cafe',
      language: 'hinglish',
      hasPhoto: true,
      hasOffer: false,
      hasPrice: true,
      avoid: [],
    });
    expect(text).toMatch(/ONLY the asked change/);
    expect(text).toMatch(/facts_request to true/);
  });
});
