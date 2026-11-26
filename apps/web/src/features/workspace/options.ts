// Choices shown in forms. They mirror the CHECK constraints in the M2 migration.

export const industryOptions = [
  { value: 'food', label: 'Restaurant, café or cloud kitchen' },
  { value: 'retail', label: 'Retail or fashion store' },
  { value: 'beauty', label: 'Salon, beauty studio or spa' },
  { value: 'other', label: 'Something else' },
] as const;
export type IndustryValue = (typeof industryOptions)[number]['value'];

export const languageOptions = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'mr', label: 'Marathi' },
  { value: 'hinglish', label: 'Hinglish' },
] as const;
export type LanguageValue = (typeof languageOptions)[number]['value'];

export const toneOptions = [
  { value: 'friendly', label: 'Friendly', example: 'Fresh chai, warm smiles. See you soon!' },
  { value: 'premium', label: 'Premium', example: 'Crafted with care. Served with distinction.' },
  { value: 'playful', label: 'Playful', example: 'Chai-o-clock? Always!' },
  { value: 'professional', label: 'Professional', example: 'Quality service, every visit.' },
  { value: 'festive', label: 'Festive', example: 'Celebrate the season with us!' },
] as const;
export type ToneValue = (typeof toneOptions)[number]['value'];

export const fontOptions = [
  { value: 'Jost', label: 'Jost (clean, modern)' },
  { value: 'Inter', label: 'Inter (simple, readable)' },
  { value: 'Noto Sans Devanagari', label: 'Noto Sans Devanagari (Hindi / Marathi)' },
] as const;
export type FontValue = (typeof fontOptions)[number]['value'];
