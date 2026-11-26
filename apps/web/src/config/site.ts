/**
 * Business and contact details shown on the Contact and legal pages.
 * TODO(owner): replace every "[ ... ]" placeholder with real details before
 * applying for a live Razorpay account (payment-gateway.md, go-live checklist).
 */
export const site = {
  name: 'Kalpix',
  legalName: '[Registered business name]',
  supportEmail: '[support@your-domain.in]',
  supportPhone: '[+91 XXXXX XXXXX]',
  city: '[City], India',
  grievanceOfficer: '[Grievance officer name]',
  lastUpdated: '24 November 2026',
} as const;

export const mainNav = [
  { label: 'Styles', to: '/styles' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Free try', to: '/try' },
  { label: 'Contact', to: '/contact' },
] as const;

export const footerNav = {
  product: [
    { label: 'Style gallery', to: '/styles' },
    { label: 'Pricing', to: '/pricing' },
    { label: 'Free try', to: '/try' },
    { label: 'Create free account', to: '/signup' },
  ],
  company: [
    { label: 'Contact us', to: '/contact' },
    { label: 'Privacy policy', to: '/privacy' },
    { label: 'Terms & conditions', to: '/terms' },
    { label: 'Refund & cancellation', to: '/refunds' },
  ],
} as const;
