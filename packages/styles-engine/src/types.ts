import type { Aspect } from './formats';
import type { Outline } from './outline/trace';

/** How the highlight outline looks: brand accent colour, neon glow or gold. */
export type OutlineStyle = 'brand' | 'neon' | 'gold';

/**
 * Facts that may appear on an ad. Callers pass a value ONLY if the owner has confirmed it
 * (PRD: prices, offers, dates, phone and address come only from confirmed fields).
 * The template never invents or edits these strings; it only draws them.
 */
export type AdFacts = {
  offer?: string | null;
  price?: string | null;
  validity?: string | null;
  phone?: string | null;
  address?: string | null;
};

/** Look of a scene type's code-drawn stand-in (matches ai_scene_types.preview_style). */
export type SceneStyle = 'steam' | 'festive' | 'sunrise' | 'spa' | 'studio';

/** The AI scene behind the ad (composite mode). videoUrl = an approved AI clip. */
export type AdScene = { style: SceneStyle; videoUrl?: string | null };

export type BrandStyle = {
  primary: string;
  secondary: string;
  accent: string;
  fontHeading: string;
  fontBody: string;
};

export type OutlineHighlightProps = {
  aspect: Aspect;
  businessName: string;
  headline: string;
  productName: string;
  /** Cutout (or photo) URL. Text is never baked into images. */
  productImageUrl?: string | null;
  logoUrl?: string | null;
  /** Call to action label, e.g. "Order on WhatsApp". */
  cta: string;
  facts: AdFacts;
  brand: BrandStyle;
  outlineStyle: OutlineStyle;
  /**
   * The product's traced outline (traceOutline). The highlight follows this real shape and
   * the product is shown cut out inside it. Without it, the product sits in a rounded frame.
   */
  productOutline?: Outline | null;
  /**
   * Link encoded in the end-card QR code (the campaign's qr-redirect URL). Passed only when its
   * target (WhatsApp/call on the confirmed phone, or the confirmed address) is confirmed.
   */
  qrUrl?: string | null;
  /** AI scene behind everything (composite: the product and all text stay code-drawn). */
  scene?: AdScene | null;
  /** Free-plan watermark (PRD 10). */
  watermark?: boolean;
};
