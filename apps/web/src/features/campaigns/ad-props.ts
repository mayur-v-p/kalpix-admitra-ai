// The fact gate lives in @admitra/styles-engine so the browser preview and the render worker
// apply exactly the same rule: only owner-confirmed facts reach the ad.
import {
  buildAdProps as buildFromSnapshot,
  type AdInputs as EngineAdInputs,
  type AdScene,
  type Aspect,
  type Outline,
} from '@admitra/styles-engine';
import type { Product } from '@/features/products/api';
import type { BrandKit, BusinessLocation, BusinessProfile } from '@/features/workspace/api';
import type { Campaign } from './api';

export type { MissingFact } from '@admitra/styles-engine';

export type AdInputs = {
  campaign: Campaign;
  business: BusinessProfile;
  location: BusinessLocation | null;
  brandKit: BrandKit | null;
  product: Product | null;
  productImageUrl: string | null;
  /** Traced product shape; null = the product sits in a rounded frame. */
  productOutline?: Outline | null;
  logoUrl: string | null;
  aspect: Aspect;
  watermark: boolean;
  qrUrl?: string | null;
  scene?: AdScene | null;
};

export function buildAdProps(i: AdInputs) {
  return buildFromSnapshot(i satisfies EngineAdInputs);
}
