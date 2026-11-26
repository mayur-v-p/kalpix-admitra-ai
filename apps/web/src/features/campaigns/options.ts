// Mirrors the CHECK constraints on public.campaigns.

export const goalOptions = [
  { value: 'sale', label: 'Sale or discount' },
  { value: 'new_product', label: 'New product launch' },
  { value: 'festival', label: 'Festival offer' },
  { value: 'event', label: 'Event' },
  { value: 'booking', label: 'Bookings / appointments' },
  { value: 'visit', label: 'Bring people to the shop' },
] as const;

export const ctaOptions = [
  { value: 'whatsapp', label: 'Order on WhatsApp' },
  { value: 'call', label: 'Call now' },
  { value: 'visit', label: 'Visit us today' },
  { value: 'book', label: 'Book now' },
  { value: 'order', label: 'Order now' },
] as const;

export const campaignLanguageOptions = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'mr', label: 'Marathi' },
  { value: 'hinglish', label: 'Hinglish' },
] as const;

export const outlineStyleOptions = [
  { value: 'brand', label: 'Brand colour' },
  { value: 'neon', label: 'Neon glow' },
  { value: 'gold', label: 'Gold' },
] as const;

export type Goal = (typeof goalOptions)[number]['value'];
export type Cta = (typeof ctaOptions)[number]['value'];
export type CampaignLanguage = (typeof campaignLanguageOptions)[number]['value'];
export type OutlineStyleValue = (typeof outlineStyleOptions)[number]['value'];

/** Call-to-action text drawn on the ad, in the campaign's language (shared with the renderer). */
export { CTA_LABELS as ctaLabels } from '@admitra/styles-engine';
