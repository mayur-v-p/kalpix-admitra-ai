// OpenAI image calls for product pictures (enhance-product-image, make-product-pictures).
//
// Secrets: OPENAI_API_KEY only in Supabase secrets. Model and quality can change without code:
//   OPENAI_IMAGE_MODEL   (default gpt-image-2)
//   OPENAI_IMAGE_QUALITY (low | medium | high; default medium)
// Only the product photo and a short scene description are sent: never prices, phone numbers,
// addresses or other facts.
import { decodeBase64 } from 'jsr:@std/encoding@1/base64';

export const DEFAULT_IMAGE_MODEL = 'gpt-image-2';
export type ImageResult = { bytes: Uint8Array; contentType: string; provider: string };

const model = () => Deno.env.get('OPENAI_IMAGE_MODEL') || DEFAULT_IMAGE_MODEL;
const quality = () => {
  const q = Deno.env.get('OPENAI_IMAGE_QUALITY');
  return q === 'low' || q === 'high' ? q : 'medium';
};

/** Rules every picture prompt ends with. */
export const PICTURE_RULES =
  'Realistic, natural-looking photography. No text, no letters, no numbers, no prices, no logos, no watermarks, no people’s faces.';

/** Same product, kept exactly as it is: the rule for every edit of the owner's photo. */
export const KEEP_PRODUCT =
  'Keep the product exactly the same as in the photo: same shape, colours, proportions, packaging and details. Do not add, remove or change any part of the product.';

async function read(res: Response): Promise<ImageResult> {
  if (!res.ok) {
    // Only the code and field, never the message (it can quote the prompt).
    const err = (await res.json().catch(() => null))?.error;
    throw new Error(`openai_image_${res.status} ${String(err?.code ?? '')}`.trim());
  }
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (typeof b64 !== 'string') throw new Error('openai_image_empty');
  return { bytes: decodeBase64(b64), contentType: 'image/jpeg', provider: 'openai' };
}

/** Edits the owner's photo (enhance, or place the same product in a new scene). */
export async function editImage(image: Blob, prompt: string, timeoutMs = 120000) {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new Error('openai_not_configured');
  const fd = new FormData();
  fd.append('model', model());
  fd.append('image', image, `photo.${image.type === 'image/png' ? 'png' : 'jpg'}`);
  fd.append('prompt', prompt);
  fd.append('size', '1024x1536');
  fd.append('quality', quality());
  fd.append('output_format', 'jpeg');
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: fd,
    signal: AbortSignal.timeout(timeoutMs),
  });
  return read(res);
}

/** Makes a new picture from words only (a product without a photo). */
export async function generateImage(prompt: string, timeoutMs = 120000) {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new Error('openai_not_configured');
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model(),
      prompt,
      size: '1024x1536',
      quality: quality(),
      output_format: 'jpeg',
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  return read(res);
}
