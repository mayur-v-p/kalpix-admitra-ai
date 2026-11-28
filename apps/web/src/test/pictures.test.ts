import { checkRecipe, pickBest, surpriseRecipe, type RecipeContext } from '@admitra/styles-engine';
import { describe, expect, it } from 'vitest';
import { recipeContext, surpriseLooks } from '@/features/design/api';
import { adImagePath } from '@/features/products/ad-image';
import { pictureFor, pictureTag, type ProductPicture } from '@/features/products/pictures';

const pic = (id: string, kind: 'scene' | 'generated', use_in_ads = true): ProductPicture => ({
  id,
  kind,
  use_in_ads,
  url: `https://img/${id}.jpg`,
  path: `ws/pictures/${id}.jpg`,
  label: id,
  product_id: 'p1',
  workspace_id: 'ws',
  provider: 'openai',
  created_at: '2026-11-28T00:00:00Z',
});
const ctx: RecipeContext = {
  sector: 'sweets',
  purpose: 'promote',
  language: 'hinglish',
  businessName: 'Mithai Ghar',
  productName: 'Gulab Jamun',
  specialities: [],
  hasPhoto: true,
  pictureIds: ['s1', 'g1'],
};

describe('which picture an ad uses', () => {
  const list = [pic('g1', 'generated'), pic('s1', 'scene'), pic('off', 'scene', false)];

  it('uses the ticked picture a design names', () => {
    expect(pictureFor('s1', list, 'https/main.jpg')).toMatchObject({ url: 'https://img/s1.jpg' });
  });

  it('never uses an unticked picture: the main photo instead', () => {
    expect(pictureFor('off', list, 'https/main.jpg')).toEqual({
      url: 'https/main.jpg',
      picture: null,
    });
  });

  it('uses the newest ticked picture when there is no photo', () => {
    expect(pictureFor(null, list, null).picture?.id).toBe('g1');
    expect(pictureFor(null, [], null)).toEqual({ url: null, picture: null });
  });

  it('labels each look with where its picture came from', () => {
    expect(pictureTag(list[0]!, false)).toBe('AI picture');
    expect(pictureTag(list[1]!, true)).toBe('AI scene');
    expect(pictureTag(null, true)).toBe('Your photo');
    expect(pictureTag(null, false)).toBeNull();
  });

  it('ads use the whole photo, never the cut-out', () => {
    const product = {
      image_path: 'ws/chai.jpg',
      cutout_path: 'ws/cut.png',
      cutout_status: 'ready',
      enhanced_path: 'ws/enh.jpg',
      enhanced_status: 'ready',
      use_enhanced: false,
    };
    expect(adImagePath(product)).toBe('ws/chai.jpg');
    expect(adImagePath({ ...product, use_enhanced: true })).toBe('ws/enh.jpg');
  });
});

describe('designs and pictures', () => {
  it('keeps a picture only when the owner ticked it', () => {
    const base = surpriseRecipe(3, ctx);
    expect(checkRecipe({ ...base, picture: 's1' }, ctx).picture).toBe('s1');
    expect(checkRecipe({ ...base, picture: 'someone-elses' }, ctx).picture).toBeNull();
    expect(checkRecipe({ ...base, picture: 's1' }, { ...ctx, pictureIds: [] }).picture).toBeNull();
  });

  it('gives the no-AI designs different pictures', () => {
    const looks = surpriseLooks(ctx, [], 6);
    expect(new Set(looks.map((l) => l.picture ?? 'main'))).toEqual(new Set(['main', 's1', 'g1']));
    const { shown } = pickBest(looks, ctx);
    expect(new Set(shown.map((l) => l.recipe.picture ?? 'main')).size).toBeGreaterThan(1);
  });

  it('a product with only AI pictures still gets photo layouts', () => {
    const c = recipeContext(
      { purpose: 'promote', language: 'hi' },
      { name: 'Mithai Ghar', industry: 'sweets', specialities: [] },
      'Gulab Jamun',
      false,
      ['g1'],
    );
    expect(c.hasPhoto).toBe(true);
    expect(c.pictureIds).toEqual(['g1']);
  });
});

describe('picture ideas (make-product-pictures)', async () => {
  const path = '@supabase-functions/_shared/picture-ideas.ts';
  const kit = (await import(/* @vite-ignore */ path)) as {
    checkIdeas: (
      raw: unknown,
      count: number,
      hasPhoto: boolean,
    ) => { label: string; scene: string }[];
    ideasInstructions: (b: Record<string, unknown>, count: number) => string;
  };

  it('keeps good ideas, cleans them and fills the rest', () => {
    const out = kit.checkIdeas(
      {
        ideas: [
          { label: '<b>Window</b>', scene: 'on a wooden table by a sunny window' },
          { label: '', scene: 'x' },
        ],
      },
      3,
      true,
    );
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({ label: 'bWindow/b', scene: 'on a wooden table by a sunny window' });
    expect(kit.checkIdeas(null, 3, false)).toHaveLength(3);
  });

  it('keeps the product the same when there is a photo, and never asks for text', () => {
    const text = kit.ideasInstructions(
      { productName: 'Chai', sector: 'cafe', hasPhoto: true, avoid: ['By the window'] },
      3,
    );
    expect(text).toMatch(/SAME product/);
    expect(text).toMatch(/Never mention text, signs, prices/);
    expect(text).toContain('By the window');
  });
});

describe('the server design kit knows about pictures', async () => {
  const path = '@supabase-functions/_shared/design-kit.ts';
  const kit = (await import(/* @vite-ignore */ path)) as {
    DESIGN_SCHEMA: { properties: { designs: { items: { required: string[] } } } };
    designFacts: (b: Record<string, unknown>) => string;
  };
  it('asks each design which picture it uses, and lists the pictures', () => {
    expect(kit.DESIGN_SCHEMA.properties.designs.items.required).toContain('picture');
    const facts = JSON.parse(
      kit.designFacts({
        businessName: 'A',
        pictures: [{ id: 'g1', label: 'Bowl', kind: 'generated' }],
      }),
    );
    expect(facts.pictures).toEqual([
      { id: 'g1', shows: 'Bowl', kind: 'AI picture made from the name' },
    ]);
  });
});
