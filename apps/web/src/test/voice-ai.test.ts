import { describe, expect, it } from 'vitest';
import { mergeBriefs } from '@/features/voice/ai-brief';
import { parseBrief, type VoiceBrief } from '@/features/voice/parse';

// Deno code from supabase/functions/_shared, loaded at test time (same as the copy guard test).
type BriefCheck = {
  checkBrief: (raw: unknown, today: string) => VoiceBrief;
  timeText: (start: number, end: number) => string;
  briefInstructions: (today: string, products: string[]) => string;
  indiaToday: (now?: Date) => string;
};
type CopyModule = {
  copyInstructions: (input: {
    businessName: string;
    productName: string | null;
    productDescription: string | null;
    industry: string;
    goal: 'sale';
    language: 'hi';
    tone: string;
  }) => string;
};

const TODAY = '2026-11-10';
const answer = (over: Record<string, unknown> = {}) => ({
  product: 'Saree',
  price: 1500,
  discount_percent: 20,
  start_date: '2026-11-15',
  end_date: '2026-11-20',
  start_hour: 17,
  end_hour: 21,
  goal: 'festival',
  occasion: 'Diwali',
  cta: null,
  language: null,
  business_type: 'retail',
  ...over,
});

describe('AI brief check (understand-brief)', async () => {
  const path = '@supabase-functions/_shared/brief-check.ts';
  const { checkBrief, timeText, briefInstructions, indiaToday } = (await import(
    /* @vite-ignore */ path
  )) as BriefCheck;

  it('keeps a good answer, in the same shape as the parser', () => {
    expect(checkBrief(answer(), TODAY)).toEqual({
      product: 'Saree',
      price: 1500,
      discount: 20,
      from: '2026-11-15',
      to: '2026-11-20',
      time: '5–9 PM',
      goal: 'festival',
      occasion: 'Diwali',
      businessType: 'retail',
    });
  });

  it('drops values that cannot be right instead of passing them on', () => {
    const out = checkBrief(
      answer({
        price: -5,
        discount_percent: 150,
        start_date: '2026-02-30',
        end_date: '2031-01-01',
        start_hour: 21,
        end_hour: 17,
        goal: 'giveaway',
        cta: 'sms',
        language: 'fr',
        product: '<script>x</script>',
      }),
      TODAY,
    );
    expect(out).toEqual({ goal: 'sale', occasion: 'Diwali', businessType: 'retail', product: 'scriptx/script' });
  });

  it('treats a missing or broken answer as "nothing understood"', () => {
    expect(checkBrief(null, TODAY)).toEqual({});
    expect(checkBrief('oops', TODAY)).toEqual({});
    expect(checkBrief(answer({ price: null, discount_percent: null }), TODAY)).not.toHaveProperty('price');
  });

  it('puts reversed dates in order and ignores dates far in the past', () => {
    const out = checkBrief(answer({ start_date: '2026-11-20', end_date: '2026-11-15' }), TODAY);
    expect([out.from, out.to]).toEqual(['2026-11-15', '2026-11-20']);
    expect(checkBrief(answer({ start_date: '2025-01-01' }), TODAY).from).toBeUndefined();
  });

  it('writes times like the parser does', () => {
    expect(timeText(17, 21)).toBe('5–9 PM');
    expect(timeText(10, 13)).toBe('10 AM – 1 PM');
    expect(timeText(9, 11)).toBe('9–11 AM');
    expect(timeText(12, 15)).toBe('12–3 PM');
  });

  it("tells the model today's date, the owner's products and not to invent facts", () => {
    const text = briefInstructions(TODAY, ['Masala Chai']);
    expect(text).toContain(TODAY);
    expect(text).toContain('"Masala Chai"');
    expect(text).toMatch(/Never guess or invent a price/);
  });

  it("uses India's date", () => {
    // 20:00 UTC on 10 Nov is already 11 Nov in India.
    expect(indiaToday(new Date('2026-11-10T20:00:00Z'))).toBe('2026-11-11');
  });
});

describe('AI ad text instructions (generate-copy)', async () => {
  const path = '@supabase-functions/_shared/copywriter.ts';
  const { copyInstructions } = (await import(/* @vite-ignore */ path)) as CopyModule;

  it('asks for the ad language and forbids prices, numbers and dates', () => {
    const text = copyInstructions({
      businessName: 'Rang Boutique',
      productName: 'Saree',
      productDescription: null,
      industry: 'retail',
      goal: 'sale',
      language: 'hi',
      tone: 'friendly',
    });
    expect(text).toContain('Hindi in Devanagari script');
    expect(text).toMatch(/Do NOT write any price, discount, percentage, number, date/);
  });
});

describe('putting the AI and parser readings together', () => {
  const library = [
    { id: 'p1', name: 'Silk Saree' },
    { id: 'p2', name: 'Cotton Kurta' },
  ];

  it('keeps the parser reading when there is no AI answer', () => {
    const basic = parseBrief('Saree 1500 rupaye, 20 percent discount', library);
    expect(mergeBriefs(basic, null, library)).toEqual(basic);
  });

  it('lets AI values win and fills gaps from the parser', () => {
    const basic: VoiceBrief = { price: 1500, time: '5–9 PM', goal: 'sale' };
    const out = mergeBriefs(basic, { price: 1600, discount: 20, goal: 'festival' }, []);
    expect(out).toEqual({ price: 1600, discount: 20, time: '5–9 PM', goal: 'festival' });
  });

  it("matches the AI's product to the owner's saved product", () => {
    expect(mergeBriefs({}, { product: 'silk saree' }, library)).toMatchObject({
      product: 'Silk Saree',
      productId: 'p1',
    });
    expect(mergeBriefs({}, { product: 'Kurta' }, library)).toMatchObject({
      product: 'Cotton Kurta',
      productId: 'p2',
    });
  });

  it("drops the parser's product match when the AI heard a different, new product", () => {
    const basic: VoiceBrief = { product: 'Silk Saree', productId: 'p1' };
    const out = mergeBriefs(basic, { product: 'Lehenga' }, library);
    expect(out.product).toBe('Lehenga');
    expect(out.productId).toBeUndefined();
  });
});
