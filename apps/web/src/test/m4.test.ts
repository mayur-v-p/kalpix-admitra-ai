import {
  ASPECTS,
  FORMATS,
  OUTLINE_HIGHLIGHT_DURATION_FRAMES,
  phase,
  highlightLayout,
} from '@admitra/styles-engine';
import { describe, expect, it } from 'vitest';
import { buildAdProps, type AdInputs } from '@/features/campaigns/ad-props';
import { briefSchema, formatValidity } from '@/features/campaigns/schemas';

// ---------------------------------------------------------------- the fact gate
const now = '2026-11-25T10:00:00Z';
const base = (): AdInputs =>
  ({
    aspect: '9:16',
    watermark: true,
    productImageUrl: null,
    logoUrl: null,
    brandKit: null,
    business: { name: 'Kesar Chai House', phone: '+91 98765 43210', phone_confirmed_at: null },
    location: { address: '12 FC Road', city: 'Pune', confirmed_at: null },
    product: { name: 'Masala Chai', price: 30, price_confirmed_at: null },
    campaign: {
      headline: null,
      offer_text: '20% OFF',
      start_date: '2026-12-01',
      end_date: '2026-12-07',
      facts_confirmed_at: null,
      cta: 'whatsapp',
      language: 'en',
      outline_style: 'brand',
    },
  }) as unknown as AdInputs;

describe('fact gate: only confirmed facts reach the ad', () => {
  it('leaves every unconfirmed fact off the ad and lists it as missing', () => {
    const { props, missing } = buildAdProps(base());
    expect(props.facts).toEqual({
      offer: null,
      validity: null,
      price: null,
      phone: null,
      address: null,
    });
    expect(missing.sort()).toEqual(['address', 'offer', 'phone', 'price']);
  });

  it('shows each fact exactly as confirmed', () => {
    const i = base();
    (i.campaign as { facts_confirmed_at: string | null }).facts_confirmed_at = now;
    (i.product as { price_confirmed_at: string | null }).price_confirmed_at = now;
    (i.business as { phone_confirmed_at: string | null }).phone_confirmed_at = now;
    (i.location as { confirmed_at: string | null }).confirmed_at = now;
    const { props, missing } = buildAdProps(i);
    expect(missing).toEqual([]);
    expect(props.facts).toEqual({
      offer: '20% OFF',
      validity: 'Valid 1 Dec – 7 Dec 2026',
      price: '₹30',
      phone: '+91 98765 43210',
      address: '12 FC Road, Pune',
    });
  });

  it('uses the CTA in the ad language and a Devanagari font for Hindi/Marathi', () => {
    const i = base();
    (i.campaign as { language: string }).language = 'hi';
    const { props } = buildAdProps(i);
    expect(props.cta).toBe('WhatsApp पर ऑर्डर करें');
    expect(props.brand.fontBody).toBe('Noto Sans Devanagari');
  });

  it('falls back to the product name when there is no headline yet', () => {
    expect(buildAdProps(base()).props.headline).toBe('Masala Chai');
  });
});

// ---------------------------------------------------------------- brief rules
describe('campaign brief', () => {
  const brief = {
    name: 'Chai Week',
    goal: 'sale',
    product_id: '',
    offer_text: '',
    start_date: '',
    end_date: '',
    cta: 'whatsapp',
    language: 'en',
  };

  it('accepts a minimal brief and turns blanks into null', () => {
    const r = briefSchema.parse(brief);
    expect(r.product_id).toBeNull();
    expect(r.offer_text).toBeNull();
  });

  it('rejects an end date before the start date and an over-long offer', () => {
    const r = briefSchema.safeParse({
      ...brief,
      start_date: '2026-12-07',
      end_date: '2026-12-01',
      offer_text: 'x'.repeat(41),
    });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.path.join('.'))).toEqual(
      expect.arrayContaining(['end_date', 'offer_text']),
    );
  });

  it('formats validity dates', () => {
    expect(formatValidity('2026-12-01', '2026-12-01')).toBe('Valid 1 Dec 2026');
    expect(formatValidity('2026-12-01', null)).toBe('From 1 Dec 2026');
    expect(formatValidity(null, null)).toBeNull();
  });
});

// ---------------------------------------------------------------- Outline Highlight template
describe('Outline Highlight layout', () => {
  it('is 15 seconds with phases in order', () => {
    expect(OUTLINE_HIGHLIGHT_DURATION_FRAMES).toBe(450);
    // brand name drawn -> product outline -> sketch -> colour fill -> product name drawn
    expect(phase('brandDraw')[0]).toBeLessThan(phase('productOutline')[0]);
    expect(phase('productOutline')[0]).toBeLessThan(phase('sketch')[0]);
    expect(phase('sketch')[0]).toBeLessThan(phase('fill')[0]);
    expect(phase('fill')[0]).toBeLessThan(phase('nameDraw')[0]);
    expect(phase('nameDraw')[1]).toBeLessThanOrEqual(phase('offer')[0]);
    expect(phase('endCard')[1]).toBe(450);
  });

  it.each(ASPECTS)('%s keeps every part inside the frame and inside the safe margin', (aspect) => {
    const l = highlightLayout(aspect);
    expect(l.width).toBe(FORMATS[aspect].width);
    for (const box of [l.header, l.product, l.details]) {
      expect(box.x).toBeGreaterThanOrEqual(l.margin - 1);
      expect(box.y).toBeGreaterThanOrEqual(l.margin - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(l.width - l.margin + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(l.height - l.margin + 1);
    }
  });
});

// ---------------------------------------------------------------- AI copy guard (Edge Function code)
describe('AI copy guard', async () => {
  const path = '@supabase-functions/_shared/copywriter.ts';
  const { guardCopy } = (await import(
    /* @vite-ignore */ path
  )) as typeof import('./copywriter-types');
  const names = { businessName: 'Kesar Chai House', productName: 'Masala Chai' };

  it('drops suggestions with invented prices, percentages or numbers', () => {
    const out = guardCopy(
      {
        headlines: [
          'Fresh chai every morning',
          '50% OFF today only',
          'Just ₹10 a cup',
          'Rs 20 combo',
          'Buy 2 get 1',
          'सिर्फ़ ५० रुपये',
        ],
        captions: ['Come by today!', 'Only 99 left'],
        hashtags: ['#chai', '#sale50'],
      },
      names,
    );
    expect(out.headlines).toEqual(['Fresh chai every morning']);
    expect(out.captions).toEqual(['Come by today!']);
    expect(out.hashtags).toEqual(['#chai']);
  });

  it("allows numbers that are part of the owner's own names", () => {
    const out = guardCopy(
      { headlines: ['Welcome to Cafe 24'], captions: [], hashtags: ['#Cafe24'] },
      {
        businessName: 'Cafe 24',
        productName: null,
      },
    );
    expect(out.headlines).toEqual(['Welcome to Cafe 24']);
    expect(out.hashtags).toEqual(['#Cafe24']);
  });
});
