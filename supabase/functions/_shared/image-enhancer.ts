// AI product image enhancement behind one small interface (PRD 4.1, "AI-enhanced product").
// Pick one with the IMAGE_ENHANCE_PROVIDER secret.
//
//   mock (default, TEST MODE): returns the image unchanged. No account needed.
//
// A real provider (an image-editing API) implements ImageEnhancer: it receives ONLY the
// product image, never prices, phone numbers or other facts, and must return the same product
// (cleaner light, background, sharpness): the owner compares and chooses before it is used.

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

const providers: Record<string, ImageEnhancer> = { mock };

export function getImageEnhancer(): ImageEnhancer {
  const name = Deno.env.get('IMAGE_ENHANCE_PROVIDER') ?? 'mock';
  const provider = providers[name];
  if (!provider) throw new Error(`Unknown IMAGE_ENHANCE_PROVIDER "${name}"`);
  return provider;
}
