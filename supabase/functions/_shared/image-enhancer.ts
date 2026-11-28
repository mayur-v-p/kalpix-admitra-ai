// AI product image enhancement behind one small interface (PRD 4.1, "AI-enhanced product").
// Pick one with the IMAGE_ENHANCE_PROVIDER secret; by default:
//
//   openai: when OPENAI_API_KEY is set. Retouches the owner's photo (light, colour,
//           sharpness, a cleaner background) and keeps the product exactly the same.
//   mock (TEST MODE, no key): returns the image unchanged. No account needed.
//
// A provider receives ONLY the product image, never prices, phone numbers or other facts. The
// owner can always go back to their original photo.
import { editImage, KEEP_PRODUCT, PICTURE_RULES } from './openai-images.ts';

export type Enhanced = { bytes: Uint8Array; contentType: string; provider: string };

export interface ImageEnhancer {
  readonly name: string;
  enhance(image: Blob): Promise<Enhanced>;
}

const mock: ImageEnhancer = {
  name: 'mock',
  async enhance(image) {
    return {
      bytes: new Uint8Array(await image.arrayBuffer()),
      contentType: image.type || 'image/png',
      provider: 'mock',
    };
  },
};

export const ENHANCE_PROMPT = [
  'Professional product photo retouch of this photo, for a social media ad.',
  KEEP_PRODUCT,
  'Improve only the photo: brighter, warm natural light, true and rich colours, sharper detail, a gentle soft shadow, and a cleaner, calmer background in the same setting.',
  PICTURE_RULES,
].join(' ');

const openai: ImageEnhancer = {
  name: 'openai',
  enhance: (image) => editImage(image, ENHANCE_PROMPT),
};

const providers: Record<string, ImageEnhancer> = { mock, openai };

export function getImageEnhancer(): ImageEnhancer {
  const name =
    Deno.env.get('IMAGE_ENHANCE_PROVIDER') ?? (Deno.env.get('OPENAI_API_KEY') ? 'openai' : 'mock');
  const provider = providers[name];
  if (!provider) throw new Error(`Unknown IMAGE_ENHANCE_PROVIDER "${name}"`);
  return provider;
}
