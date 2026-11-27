import {
  ACCENTS,
  adExtras,
  BACKGROUNDS,
  BADGES,
  checkRecipe,
  contrast,
  ENTERS,
  FONT_PAIRS,
  ICONS,
  LAYOUTS,
  PHOTO_SHAPES,
  RHYTHMS,
  sectorOf,
  surpriseRecipe,
  type RecipeContext,
} from '@admitra/styles-engine';
import { describe, expect, it } from 'vitest';
import { detectPurpose } from '@/features/voice/parse';
import { surpriseLooks } from '@/features/design/api';

const cafe: RecipeContext = {
  sector: 'cafe',
  purpose: 'promote',
  language: 'hinglish',
  businessName: 'Cafe 24',
  productName: 'Masala Chai',
  specialities: ['Masala chai', 'Bun maska'],
  hasPhoto: true,
};

describe('design recipe checker', () => {
  it('turns anything into a complete, safe recipe', () => {
    for (const raw of [null, 'junk', 42, {}, { layout: 'hack', palette: { bg: 'red' } }]) {
      const r = checkRecipe(raw, cafe);
      expect(LAYOUTS).toContain(r.layout);
      expect(r.palette.bg).toMatch(/^#[0-9a-f]{6}$/);
      expect(r.headline.text.length).toBeGreaterThan(0);
    }
  });

  it('drops AI words that carry prices, numbers or percentages', () => {
    const r = checkRecipe(
      { headline: { text: '50% OFF today' }, tagline: 'Only ₹99', cta: 'Call 98765' },
      cafe,
    );
    expect(r.headline.text).not.toMatch(/50/);
    expect(r.tagline).toBeNull();
    expect(r.cta).toBeNull();
  });

  it("allows numbers that are part of the shop's own name", () => {
    expect(checkRecipe({ headline: { text: 'Welcome to Cafe 24' } }, cafe).headline.text).toBe(
      'Welcome to Cafe 24',
    );
  });

  it('keeps only chips from the owner’s own specialities', () => {
    const r = checkRecipe({ chips: ['Masala chai', 'Best in town', 'Free wifi'] }, cafe);
    expect(r.chips).toEqual(['Masala chai']);
  });

  it('refuses health claims for healthcare businesses', () => {
    const clinic: RecipeContext = { ...cafe, sector: 'clinic', businessName: 'Shanti Clinic' };
    const r = checkRecipe(
      { headline: { text: 'Best doctor in Pune' }, tagline: 'Guaranteed cure for diabetes' },
      clinic,
    );
    expect(r.headline.text).not.toMatch(/best/i);
    expect(r.tagline).toBeNull();
    // The same words are fine for a café.
    expect(checkRecipe({ headline: { text: 'Best chai in Pune' } }, cafe).headline.text).toBe(
      'Best chai in Pune',
    );
  });

  it('fixes colours that would be hard to read', () => {
    const r = checkRecipe(
      {
        palette: {
          bg: '#ffffff',
          bg2: '#f4f4f4',
          ink: '#eeeeee',
          accent: '#fafafa',
          onAccent: '#ffffff',
        },
      },
      cafe,
    );
    expect(contrast(r.palette.ink, r.palette.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(r.palette.ink, r.palette.bg2)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(r.palette.onAccent, r.palette.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(r.palette.accent, r.palette.bg)).toBeGreaterThanOrEqual(3);
  });

  it('keeps sizes and rotation within limits', () => {
    const r = checkRecipe({ photo: { rotate: 90, scale: 9 }, headline: { size: 5 } }, cafe);
    expect(r.photo.rotate).toBe(8);
    expect(r.photo.scale).toBe(1.2);
    expect(r.headline.size).toBe(1.3);
  });

  it('never hides the photo, and needs one for photo layouts', () => {
    expect(checkRecipe({ photo: { shape: 'none' } }, cafe).photo.shape).not.toBe('none');
    const noPhoto = checkRecipe(
      { layout: 'photo_band', background: 'photo_zoom' },
      { ...cafe, hasPhoto: false },
    );
    expect(noPhoto.layout).toBe('spotlight');
    expect(noPhoto.background).not.toBe('photo_zoom');
    expect(noPhoto.photo.shape).toBe('none');
  });
});

describe('surprise designs (no AI key)', () => {
  it('gives three clearly different looks', () => {
    const looks = surpriseLooks(cafe);
    expect(looks).toHaveLength(3);
    expect(new Set(looks.map((l) => l.layout)).size).toBe(3);
  });

  it('is repeatable for a seed and fits the purpose', () => {
    expect(surpriseRecipe(7, cafe)).toEqual(surpriseRecipe(7, cafe));
    const opening = surpriseRecipe(11, { ...cafe, purpose: 'opening' });
    expect(['photo_band', 'spotlight', 'story']).toContain(opening.layout);
  });
});

describe('sectors and extras', () => {
  it('maps the original business types to sectors', () => {
    expect(sectorOf('food')).toBe('restaurant');
    expect(sectorOf('retail')).toBe('clothing');
    expect(sectorOf('clinic')).toBe('clinic');
    expect(sectorOf('unknown')).toBe('other');
  });

  it('shows hours and registration only once confirmed', () => {
    const b = {
      industry: 'real_estate',
      opening_hours: '10–7',
      registration_no: 'P521000',
      details_confirmed: false,
    };
    expect(adExtras(b)).toEqual({ hours: null, registration: null });
    expect(adExtras({ ...b, details_confirmed: true })).toEqual({
      hours: '10–7',
      registration: 'RERA No. P521000',
    });
  });
});

describe('ad purpose from speech', () => {
  const w = (s: string) => s.toLowerCase().split(' ');
  it('understands what the ad is for', () => {
    expect(detectPurpose(w('mere cafe ka promotion karo'), false)).toBe('promote');
    expect(detectPurpose(w('hamari grand opening hai'), false)).toBe('opening');
    expect(detectPurpose(w('aaj ka menu dikhao'), false)).toBe('menu');
    expect(detectPurpose(w('diwali ki shubhkamnayein'), false)).toBe('festival');
    expect(detectPurpose(w('saree pe discount'), true)).toBe('offer');
    expect(detectPurpose(w('new collection aaya'), false)).toBe('new_arrivals');
  });
});

describe('the server’s design kit matches the engine', async () => {
  const path = '@supabase-functions/_shared/design-kit.ts';
  const kit = (await import(/* @vite-ignore */ path)) as Record<string, string[]>;
  it('offers the AI exactly the pieces the Composer can draw', () => {
    expect(kit.LAYOUTS).toEqual([...LAYOUTS]);
    expect(kit.ENTERS).toEqual([...ENTERS]);
    expect(kit.BACKGROUNDS).toEqual([...BACKGROUNDS]);
    expect(kit.ACCENTS).toEqual([...ACCENTS]);
    expect(kit.BADGES).toEqual([...BADGES]);
    expect(kit.PHOTO_SHAPES).toEqual([...PHOTO_SHAPES]);
    expect(kit.FONT_PAIRS).toEqual([...FONT_PAIRS]);
    expect(kit.ICONS).toEqual([...ICONS]);
    expect(kit.RHYTHMS).toEqual([...RHYTHMS]);
  });
});
