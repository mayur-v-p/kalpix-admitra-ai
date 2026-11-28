import type { Product } from './api';

type ImageFields = Pick<
  Product,
  | 'image_path'
  | 'cutout_path'
  | 'cutout_status'
  | 'enhanced_path'
  | 'enhanced_status'
  | 'use_enhanced'
>;

/**
 * The image ads use for a product. Mirrors private.product_ad_image in the database:
 * the AI-enhanced photo if chosen (the default once it is ready), else the original photo.
 * Cut-outs are no longer used: ads frame the whole photo.
 */
export function adImagePath(p: ImageFields | null | undefined): string | null {
  if (!p) return null;
  if (p.use_enhanced && p.enhanced_status === 'ready' && p.enhanced_path) return p.enhanced_path;
  return p.image_path;
}
