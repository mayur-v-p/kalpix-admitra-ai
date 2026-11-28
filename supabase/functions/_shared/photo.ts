// The photo an ad uses, handed to the AI to look at (design-ad).
//
// Read with the caller's own client, so storage RLS still decides what they may read.
// - Hosted Supabase: a signed link valid for 2 minutes (OpenAI fetches it; no work here).
// - Local Supabase (127.0.0.1, kong): OpenAI cannot reach it, so the photo is sent as a
//   data: URL instead.
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

type ProductImage = {
  image_path: string | null;
  cutout_path?: string | null;
  cutout_status?: string | null;
  enhanced_path?: string | null;
  enhanced_status?: string | null;
  use_enhanced?: boolean | null;
};

/** Same choice as the website and the export: the enhanced photo if chosen, else the original. */
export function adImagePath(p: ProductImage | null): string | null {
  if (!p) return null;
  if (p.use_enhanced && p.enhanced_status === 'ready' && p.enhanced_path) return p.enhanced_path;
  return p.image_path;
}

const BUCKET = 'product-images';
const MAX_BYTES = 1_500_000;
const TYPES = /^image\/(jpeg|png|webp)$/;
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|kong|host\.docker\.internal)(:\d+)?(\/|$)/i;

/** A link or data: URL the AI can open, or null when there is no usable photo. */
export async function photoForAi(client: SupabaseClient, path: string | null) {
  if (!path) return null;
  try {
    if (!LOCAL.test(Deno.env.get('SUPABASE_URL') ?? '')) {
      const { data } = await client.storage.from(BUCKET).createSignedUrl(path, 120);
      return data?.signedUrl ?? null;
    }
    const { data, error } = await client.storage.from(BUCKET).download(path);
    if (error || !data || data.size > MAX_BYTES) return null;
    const type = TYPES.test(data.type) ? data.type : guessType(path);
    if (!type) return null;
    return `data:${type};base64,${encodeBase64(new Uint8Array(await data.arrayBuffer()))}`;
  } catch {
    return null;
  }
}

function guessType(path: string): string | null {
  const ext = path.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return null;
}
