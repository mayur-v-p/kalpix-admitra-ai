import { z } from 'zod';

// The campaign brief. Mirrors the CHECK constraints on public.campaigns.
const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Choose a date.')
  .transform((v) => (v === '' ? null : v));

export const briefSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Give the campaign a name.')
      .max(120, 'Use at most 120 characters.'),
    goal: z.enum(['sale', 'new_product', 'festival', 'event', 'booking', 'visit']),
    product_id: z
      .string()
      .transform((v) => (v === '' ? null : v))
      .nullable(),
    offer_text: z
      .string()
      .trim()
      .max(40, 'Keep the offer short: at most 40 characters.')
      .transform((v) => (v === '' ? null : v)),
    start_date: optionalDate,
    end_date: optionalDate,
    cta: z.enum(['whatsapp', 'call', 'visit', 'book', 'order']),
    language: z.enum(['en', 'hi', 'mr', 'hinglish']),
  })
  .refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, {
    path: ['end_date'],
    message: 'The end date must be on or after the start date.',
  });

export type BriefInput = z.input<typeof briefSchema>;
export type BriefValues = z.output<typeof briefSchema>;

/** "Valid 1 Dec – 7 Dec 2026", or a single day. Dates are drawn exactly as confirmed. */
export { formatValidity } from '@admitra/styles-engine';
