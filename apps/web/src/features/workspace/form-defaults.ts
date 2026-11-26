import type { BrandKit, BusinessLocation, BusinessProfile } from './api';
import type { BrandFormValues, BusinessFormInput } from './schemas';

// Starting values for the business and brand forms, from what is already saved.

export function businessDefaults(
  business: BusinessProfile | null,
  location: BusinessLocation | null,
  industry?: string,
  suggestedName?: string | null,
): BusinessFormInput {
  return {
    name: business?.name ?? suggestedName ?? '',
    industry: (business?.industry ?? industry ?? 'food') as BusinessFormInput['industry'],
    description: business?.description ?? '',
    phone: business?.phone ?? '',
    website: business?.website ?? '',
    languages: (business?.languages ?? ['en']) as BusinessFormInput['languages'],
    address: location?.address ?? '',
    city: location?.city ?? '',
  };
}

export function brandDefaults(kit: BrandKit | null): BrandFormValues {
  return {
    primary_color: kit?.primary_color ?? '#1E1E1C',
    secondary_color: kit?.secondary_color ?? '#F6F4EF',
    accent_color: kit?.accent_color ?? '#F2C94C',
    font_heading: (kit?.font_heading ?? 'Jost') as BrandFormValues['font_heading'],
    font_body: (kit?.font_body ?? 'Inter') as BrandFormValues['font_body'],
    tone: (kit?.tone ?? 'friendly') as BrandFormValues['tone'],
  };
}
