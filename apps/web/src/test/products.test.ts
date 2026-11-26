import { describe, expect, it } from 'vitest';
import { formatPrice, productSchema, validatePhoto } from '@/features/products/schemas';

describe('product form rules (match the database)', () => {
  const base = { name: 'Masala Chai', description: '', price: '' };

  it('accepts a product without a price and turns blanks into null', () => {
    const r = productSchema.parse(base);
    expect(r.price).toBeNull();
    expect(r.description).toBeNull();
  });

  it('parses prices with up to two decimals', () => {
    expect(productSchema.parse({ ...base, price: '30' }).price).toBe(30);
    expect(productSchema.parse({ ...base, price: '29.50' }).price).toBe(29.5);
  });

  it.each(['-5', '12.345', '₹30', '1e3', 'thirty', '99999999999'])(
    'rejects the price "%s"',
    (price) => {
      expect(productSchema.safeParse({ ...base, price }).success).toBe(false);
    },
  );

  it('requires a name', () => {
    expect(productSchema.safeParse({ ...base, name: '  ' }).success).toBe(false);
  });

  it('only accepts PNG, JPG or WebP photos up to 10 MB', () => {
    expect(validatePhoto(new File(['x'], 'a.gif', { type: 'image/gif' }))).toMatch(
      /PNG, JPG or WebP/,
    );
    expect(
      validatePhoto(new File([new Uint8Array(11 * 1024 * 1024)], 'a.jpg', { type: 'image/jpeg' })),
    ).toMatch(/10 MB/);
    expect(validatePhoto(new File(['x'], 'a.jpg', { type: 'image/jpeg' }))).toBeNull();
  });
});

describe('price display', () => {
  it('uses rupees with Indian digit grouping', () => {
    expect(formatPrice(30)).toBe('₹30');
    expect(formatPrice(29.5)).toBe('₹29.50');
    expect(formatPrice(125000)).toBe('₹1,25,000');
    expect(formatPrice(null)).toBe('No price');
  });
});
