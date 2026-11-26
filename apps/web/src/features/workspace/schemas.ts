import { z } from 'zod';

// Form validation. Each rule mirrors a database CHECK constraint, so a form that passes
// here will not be rejected by Postgres (and the database still enforces it).

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    .transform((v) => (v === '' ? null : v));

export const businessSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Enter your business name.')
      .max(120, 'Use at most 120 characters.'),
    industry: z.enum(['food', 'retail', 'beauty', 'other'], { error: 'Choose your industry.' }),
    description: optionalText(1000),
    phone: z
      .string()
      .trim()
      .refine(
        (v) => v === '' || /^\+?[0-9 ]{7,20}$/.test(v),
        'Use digits only, e.g. +91 98765 43210.',
      )
      .transform((v) => (v === '' ? null : v)),
    website: z
      .string()
      .trim()
      .refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'Start the link with https://')
      .refine((v) => v.length <= 300, 'Use at most 300 characters.')
      .transform((v) => (v === '' ? null : v)),
    languages: z
      .array(z.enum(['en', 'hi', 'mr', 'hinglish']))
      .min(1, 'Choose at least one language.'),
    address: optionalText(300),
    city: optionalText(80),
  })
  .refine((v) => !v.address || v.city, {
    path: ['city'],
    message: 'Enter the city for this address.',
  })
  .refine((v) => !v.city || v.address, { path: ['address'], message: 'Enter the street address.' });

export type BusinessFormInput = z.input<typeof businessSchema>;
export type BusinessFormValues = z.output<typeof businessSchema>;

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use a colour like #1E1E1C.');

export const brandSchema = z.object({
  primary_color: hex,
  secondary_color: hex,
  accent_color: hex,
  font_heading: z.enum(['Jost', 'Inter', 'Noto Sans Devanagari']),
  font_body: z.enum(['Jost', 'Inter', 'Noto Sans Devanagari']),
  tone: z.enum(['friendly', 'premium', 'playful', 'professional', 'festive']),
});
export type BrandFormValues = z.infer<typeof brandSchema>;

export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const LOGO_MAX_BYTES = 5 * 1024 * 1024;

/** Same limits as the brand-assets bucket. The bucket enforces them as well. */
export function validateLogo(file: File): string | null {
  if (!(LOGO_TYPES as readonly string[]).includes(file.type))
    return 'Use a PNG, JPG or WebP image.';
  if (file.size > LOGO_MAX_BYTES) return 'The logo must be 5 MB or smaller.';
  return null;
}
