import { describe, expect, it } from 'vitest';
import {
  campaignName,
  detectLanguage,
  offerText,
  parseAnswer,
  parseBrief,
  parseCommand,
  parseDates,
  parseNumber,
  parseTime,
  yesOrNo,
} from '@/features/voice/parse';

const TODAY = new Date(2026, 10, 27); // 27 Nov 2026
const library = [
  { id: 'p1', name: 'Silk saree' },
  { id: 'p2', name: 'Cotton kurta' },
];

describe('numbers as people say them', () => {
  it.each([
    ['1500', 1500],
    ['₹1,500', 1500],
    ['pandrah sau', 1500],
    ['पंद्रह सौ', 1500],
    ['पंधराशे', 1500],
    ['dedh hazaar', 1500],
    ['do hazaar paanch sau', 2500],
    ['साढ़े तीन सौ', 350],
    ['bees', 20],
    ['वीस', 20],
    ['१२००', 1200],
    ['2 lakh', 200000],
  ])('“%s” → %d', (said, value) => {
    expect(parseNumber(said)).toBe(value);
  });
});

describe('the full Round 1 example', () => {
  const said =
    'Mere clothing store ke liye Diwali sale ka ad banao. Saree 1500 rupaye ki hai, 20 percent discount, 15 se 20 November tak, shaam 5 se 9 baje.';
  const b = parseBrief(said, library, TODAY);

  it('finds every value', () => {
    expect(b).toMatchObject({
      product: 'Silk saree',
      productId: 'p1',
      price: 1500,
      discount: 20,
      from: '2026-11-15',
      to: '2026-11-20',
      time: '5–9 PM',
      goal: 'festival',
      occasion: 'Diwali',
      language: 'hinglish',
      businessType: 'retail',
    });
  });

  it('names the campaign and builds the offer line', () => {
    expect(campaignName(b)).toBe('Diwali sale');
    expect(offerText(b.price, b.discount, b.time)).toBe('20% OFF · now ₹1,200 · 5–9 PM');
  });
});

describe('short or partial requests', () => {
  it('only the type of ad: nothing else is invented', () => {
    const b = parseBrief('Mujhe Diwali sale ka ad chahiye', library, TODAY);
    expect(b.goal).toBe('festival');
    expect(b.price).toBeUndefined();
    expect(b.discount).toBeUndefined();
    expect(b.product).toBeUndefined();
    expect(b.from).toBeUndefined();
  });

  it('Hindi in Devanagari', () => {
    const b = parseBrief('साड़ी पर बीस प्रतिशत छूट, कीमत पंद्रह सौ रुपये', library, TODAY);
    expect(b).toMatchObject({ product: 'Silk saree', discount: 20, price: 1500, language: 'hi' });
  });

  it('Marathi', () => {
    const b = parseBrief('माझ्या दुकानात साडीवर वीस टक्के सवलत आहे, किंमत पंधराशे रुपये', [], TODAY);
    expect(b).toMatchObject({ discount: 20, price: 1500, language: 'mr' });
  });

  it('English, new product, call button', () => {
    const b = parseBrief(
      'New arrival ad for our bakery, chocolate cake only Rs 450, call now',
      [],
      TODAY,
    );
    expect(b).toMatchObject({
      goal: 'new_product',
      product: 'Cake',
      price: 450,
      cta: 'call',
      businessType: 'food',
    });
  });

  it('a price said without "rupees" is still found when it is the only big number', () => {
    expect(parseBrief('kurta 799 mein, 10 percent off', library, TODAY)).toMatchObject({
      price: 799,
      discount: 10,
      productId: 'p2',
    });
  });
});

describe('dates and times', () => {
  it('ranges and single end dates', () => {
    expect(parseDates('15 se 20 November', TODAY)).toEqual({
      from: '2026-11-15',
      to: '2026-11-20',
    });
    expect(parseDates('15 नवंबर से 20 नवंबर', TODAY)).toEqual({
      from: '2026-11-15',
      to: '2026-11-20',
    });
    expect(parseDates('20 December tak', TODAY)).toEqual({ to: '2026-12-20' });
    expect(parseDates('5 January', TODAY)).toEqual({ from: '2027-01-05', to: '2027-01-05' });
  });

  it('times of day', () => {
    expect(parseTime('shaam 5 se 9 baje')).toBe('5–9 PM');
    expect(parseTime('10 am to 1 pm')).toBe('10 AM – 1 PM');
    expect(parseTime('subah 7 se 11 baje')).toBe('7–11 AM');
    expect(parseTime('20 percent off')).toBeUndefined();
  });
});

describe('answers and confirmations', () => {
  it('one field at a time', () => {
    expect(parseAnswer('price', 'pandrah sau')).toEqual({ price: 1500 });
    expect(parseAnswer('discount', 'bees percent')).toEqual({ discount: 20 });
    expect(parseAnswer('product', 'silk saree')).toEqual({ product: 'Saree' });
    expect(parseAnswer('product', 'banarasi dupatta')).toEqual({ product: 'Banarasi Dupatta' });
    expect(parseAnswer('dates', '15 se 20 November', TODAY)).toEqual({
      from: '2026-11-15',
      to: '2026-11-20',
    });
  });

  it('yes and no in Hindi, Marathi and English', () => {
    expect(yesOrNo('haan sahi hai')).toBe('yes');
    expect(yesOrNo('हो')).toBe('yes');
    expect(yesOrNo('हाँ')).toBe('yes');
    expect(yesOrNo('nahi, galat hai')).toBe('no');
    expect(yesOrNo('नको')).toBe('no');
    expect(yesOrNo('pata nahi kya')).toBe('no'); // "no" wins: never confirm by accident
    expect(yesOrNo('hmm')).toBeNull();
  });

  it('language of what was said', () => {
    expect(detectLanguage('Diwali sale ka ad banao')).toBe('hinglish');
    expect(detectLanguage('दिवाली सेल का ऐड बनाओ')).toBe('hi');
    expect(detectLanguage('दिवाळी सेलची जाहिरात बनवा')).toBe('mr');
    expect(detectLanguage('Make a weekend offer ad')).toBe('en');
  });
});

describe('Studio voice changes', () => {
  it.each([
    ['discount 30 percent karo', { kind: 'discount', value: 30 }],
    ['chhoot tees percent kar do', { kind: 'discount', value: 30 }],
    ['price 1299 karo', { kind: 'price', value: 1299 }],
    ['button call now karo', { kind: 'cta', value: 'call' }],
    ['English mein karo', { kind: 'language', value: 'en' }],
    ['मराठी मध्ये करा', { kind: 'language', value: 'mr' }],
    ['kuch aur', { kind: 'unknown' }],
  ])('“%s”', (said, cmd) => {
    expect(parseCommand(said)).toEqual(cmd);
  });

  it('keeps the offer line within the 40-character limit', () => {
    expect(offerText(149999, 15, '10 AM – 9 PM')!.length).toBeLessThanOrEqual(40);
    expect(offerText(undefined, 20)).toBe('20% OFF');
    expect(offerText(1500, undefined)).toBeNull();
  });
});
