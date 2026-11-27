import type { Purpose, Sector } from '@admitra/styles-engine';

export const SECTOR_LABELS: Record<Sector, string> = {
  cafe: 'Café',
  restaurant: 'Restaurant',
  sweets: 'Sweet shop',
  bakery: 'Bakery',
  grocery: 'Grocery / kirana',
  clothing: 'Clothing / boutique',
  jewellery: 'Jewellery',
  electronics: 'Electronics / mobiles',
  clinic: 'Doctor / clinic',
  pharmacy: 'Pharmacy / medical store',
  diagnostics: 'Diagnostic lab',
  fitness: 'Gym / fitness',
  beauty: 'Salon / beauty',
  education: 'Coaching / education',
  real_estate: 'Real estate',
  services: 'Services',
  other: 'Other',
};

export const PURPOSE_LABELS: Record<Purpose, string> = {
  promote: 'Promote my business',
  menu: 'Menu or products',
  new_arrivals: 'New arrivals',
  festival: 'Festival greeting',
  opening: 'Grand opening',
  offer: 'Offer or sale',
};
