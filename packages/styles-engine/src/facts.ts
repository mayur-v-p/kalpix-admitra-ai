// THE FACT GATE, shared by the browser preview (apps/web) and the render worker
// (apps/media-worker), so an exported ad can never show something the preview did not.
// Prices, offers, dates, phone and address reach the template ONLY if the owner confirmed them.
import type { Aspect } from './formats';
import type { Outline } from './outline/trace';
import type { OutlineHighlightProps, OutlineStyle } from './types';

export type AdLanguage = 'en' | 'hi' | 'mr' | 'hinglish';
export type AdCta = 'whatsapp' | 'call' | 'visit' | 'book' | 'order';

/** Call-to-action text drawn on the ad, in the campaign's language. */
export const CTA_LABELS: Record<AdLanguage, Record<AdCta, string>> = {
  en: {
    whatsapp: 'Order on WhatsApp',
    call: 'Call now',
    visit: 'Visit us today',
    book: 'Book now',
    order: 'Order now',
  },
  hi: {
    whatsapp: 'WhatsApp पर ऑर्डर करें',
    call: 'अभी कॉल करें',
    visit: 'आज ही आइए',
    book: 'अभी बुक करें',
    order: 'अभी ऑर्डर करें',
  },
  mr: {
    whatsapp: 'WhatsApp वर ऑर्डर करा',
    call: 'आत्ताच कॉल करा',
    visit: 'आजच भेट द्या',
    book: 'आत्ताच बुक करा',
    order: 'आत्ताच ऑर्डर करा',
  },
  hinglish: {
    whatsapp: 'WhatsApp pe order karo',
    call: 'Abhi call karo',
    visit: 'Aaj hi aao',
    book: 'Abhi book karo',
    order: 'Abhi order karo',
  },
};

/** ₹ with Indian digit grouping: 125000 -> ₹1,25,000. */
export function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined) return 'No price';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: Number.isInteger(price) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(price);
}

export function formatValidity(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  const fmt = (d: string, withYear: boolean) =>
    new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      ...(withYear ? { year: 'numeric' } : {}),
    });
  if (start && end)
    return start === end
      ? `Valid ${fmt(start, true)}`
      : `Valid ${fmt(start, false)} – ${fmt(end, true)}`;
  if (start) return `From ${fmt(start, true)}`;
  return `Until ${fmt(end!, true)}`;
}

/**
 * The database rows the ad is built from (only the columns it needs). The render worker gets
 * exactly this shape as the job's fact snapshot, taken when the owner pressed Export.
 */
export type FactSnapshot = {
  campaign: {
    headline: string | null;
    offer_text: string | null;
    start_date: string | null;
    end_date: string | null;
    facts_confirmed_at: string | null;
    cta: string;
    language: string;
    outline_style: string;
  };
  business: { name: string; phone: string | null; phone_confirmed_at: string | null };
  location: { address: string; city: string; confirmed_at: string | null } | null;
  brandKit: {
    primary_color: string | null;
    secondary_color: string | null;
    accent_color: string | null;
    font_heading: string | null;
    font_body: string | null;
  } | null;
  product: { name: string; price: number | null; price_confirmed_at: string | null } | null;
};

export type AdInputs = FactSnapshot & {
  productImageUrl: string | null;
  /** Traced product shape; null = the product sits in a rounded frame. */
  productOutline?: Outline | null;
  logoUrl: string | null;
  aspect: Aspect;
  watermark: boolean;
  /** The campaign's QR redirect link; shown only when its target is a confirmed fact. */
  qrUrl?: string | null;
};

/** Which facts are left off the ad because they are not confirmed yet. */
export type MissingFact = 'offer' | 'price' | 'phone' | 'address';

/**
 * Whether the campaign's QR code may be shown: it opens WhatsApp or a call on the confirmed
 * phone, or the map at the confirmed address. The qr-redirect Edge Function applies the same rule.
 */
export function qrAllowed(s: FactSnapshot): boolean {
  const phone = Boolean(s.business.phone && s.business.phone_confirmed_at);
  const address = Boolean(s.location?.confirmed_at);
  return s.campaign.cta === 'visit' ? address || phone : phone;
}

export function buildAdProps(i: AdInputs): {
  props: OutlineHighlightProps;
  missing: MissingFact[];
} {
  const { campaign, business, location, brandKit, product } = i;
  const missing: MissingFact[] = [];

  const factsConfirmed = Boolean(campaign.facts_confirmed_at);
  if (campaign.offer_text && !factsConfirmed) missing.push('offer');

  const priceConfirmed = Boolean(product && product.price !== null && product.price_confirmed_at);
  if (product && product.price !== null && !priceConfirmed) missing.push('price');

  const phoneConfirmed = Boolean(business.phone && business.phone_confirmed_at);
  if (business.phone && !phoneConfirmed) missing.push('phone');

  const addressConfirmed = Boolean(location && location.confirmed_at);
  if (location && !addressConfirmed) missing.push('address');

  const language = (campaign.language in CTA_LABELS ? campaign.language : 'en') as AdLanguage;
  const labels = CTA_LABELS[language];
  const cta = (campaign.cta in labels ? campaign.cta : 'whatsapp') as AdCta;

  return {
    missing,
    props: {
      aspect: i.aspect,
      businessName: business.name,
      headline: campaign.headline?.trim() || product?.name || business.name,
      productName: product?.name ?? business.name,
      productImageUrl: i.productImageUrl,
      productOutline: i.productImageUrl ? (i.productOutline ?? null) : null,
      logoUrl: i.logoUrl,
      cta: labels[cta],
      outlineStyle: campaign.outline_style as OutlineStyle,
      watermark: i.watermark,
      qrUrl: i.qrUrl && qrAllowed(i) ? i.qrUrl : null,
      brand: {
        primary: brandKit?.primary_color ?? '#1E1E1C',
        secondary: brandKit?.secondary_color ?? '#F6F4EF',
        accent: brandKit?.accent_color ?? '#F2C94C',
        fontHeading: brandKit?.font_heading ?? 'Jost',
        fontBody:
          language === 'hi' || language === 'mr'
            ? 'Noto Sans Devanagari'
            : (brandKit?.font_body ?? 'Inter'),
      },
      facts: {
        offer: factsConfirmed ? campaign.offer_text : null,
        validity: factsConfirmed ? formatValidity(campaign.start_date, campaign.end_date) : null,
        price: priceConfirmed ? formatPrice(product!.price) : null,
        phone: phoneConfirmed ? business.phone : null,
        address: addressConfirmed ? `${location!.address}, ${location!.city}` : null,
      },
    },
  };
}
