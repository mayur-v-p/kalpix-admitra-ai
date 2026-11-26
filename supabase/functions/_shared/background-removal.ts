// Background-removal providers behind one small interface (architecture.md 5.1: every AI
// provider sits behind an adapter). Pick one with the BG_REMOVAL_PROVIDER secret.
//
//   mock      (default) returns the original photo unchanged. No account needed.
//
// To add a real provider (e.g. Photoroom or BiRefNet on Replicate): implement
// BackgroundRemover, add it to `providers`, store its API key as a function secret, and set
// BG_REMOVAL_PROVIDER. Never send prices, phone numbers or other facts to the provider:
// only the product photo.

export type Cutout = { bytes: Uint8Array; contentType: string; provider: string };

export interface BackgroundRemover {
  readonly name: string;
  remove(image: Blob): Promise<Cutout>;
}

const mock: BackgroundRemover = {
  name: 'mock',
  async remove(image) {
    return {
      bytes: new Uint8Array(await image.arrayBuffer()),
      contentType: image.type || 'image/png',
      provider: 'mock',
    };
  },
};

const providers: Record<string, BackgroundRemover> = { mock };

export function getBackgroundRemover(): BackgroundRemover {
  const name = Deno.env.get('BG_REMOVAL_PROVIDER') ?? 'mock';
  const provider = providers[name];
  if (!provider) throw new Error(`Unknown BG_REMOVAL_PROVIDER "${name}"`);
  return provider;
}

export const extensionFor = (contentType: string) =>
  ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' })[contentType] ?? 'png';
