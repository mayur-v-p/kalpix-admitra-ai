import { z } from 'zod';

// Mirrors the CHECK constraints on public.products.

export const productSchema = z.object({
  name: z.string().trim().min(1, 'Enter the product name.').max(120, 'Use at most 120 characters.'),
  description: z
    .string()
    .trim()
    .max(1000, 'Use at most 1000 characters.')
    .transform((v) => (v === '' ? null : v)),
  price: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{1,8}(\.\d{1,2})?$/.test(v), 'Enter a price like 30 or 29.50.')
    .refine((v) => v === '' || Number(v) <= 10_000_000, 'That price is too high.')
    .transform((v) => (v === '' ? null : Number(v))),
});

export type ProductFormInput = z.input<typeof productSchema>;
export type ProductFormValues = z.output<typeof productSchema>;

export const PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/** Same limits as the product-images bucket (which enforces them too). */
export function validatePhoto(file: File): string | null {
  if (!(PHOTO_TYPES as readonly string[]).includes(file.type))
    return 'Use a PNG, JPG or WebP photo.';
  if (file.size > PHOTO_MAX_BYTES) return 'The photo must be 10 MB or smaller.';
  return null;
}

/** ₹30, ₹29.50, ₹1,250 (Indian digit grouping). */
export { formatPrice } from '@admitra/styles-engine';
