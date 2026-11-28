// AI pictures of a product (M11, Edge Function make-product-pictures):
//   scene      the owner's own product placed in a new setting
//   generated  made from the product's name and description (no photo); ads using one show
//              "Image for representation only"
// The owner ticks which ones ads may use; "Pick a look" gives each design a different one.
import { useQuery } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type ProductPicture = Tables<'product_pictures'> & { url: string | null };

export const REPRESENTATION_NOTE = 'Image for representation only';
export const picturesKey = (productId: string | null | undefined) => [
  'product-pictures',
  productId,
];

export async function listPictures(productId: string): Promise<ProductPicture[]> {
  const { data, error } = await supabase
    .from('product_pictures')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  if (!rows.length) return [];
  const { data: signed } = await supabase.storage.from('product-images').createSignedUrls(
    rows.map((r) => r.path),
    60 * 60,
  );
  return rows.map((r, i) => ({ ...r, url: signed?.[i]?.signedUrl ?? null }));
}

/**
 * The product's AI pictures. `waiting` keeps checking every few seconds (pictures are being
 * made somewhere else, e.g. right after the product was saved).
 */
export function useProductPictures(productId: string | null | undefined, waiting = false) {
  return useQuery({
    queryKey: picturesKey(productId),
    queryFn: () => listPictures(productId!),
    enabled: Boolean(productId),
    staleTime: 30 * 60 * 1000,
    // Pictures come in a batch of three, a few seconds apart.
    refetchInterval: (q) => (waiting && (q.state.data?.length ?? 0) < 3 ? 4000 : false),
  });
}

export class PicturesError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

/** Asks for three new AI pictures (about 30 seconds). */
export async function makePictures(
  productId: string,
  note?: string,
): Promise<{ made: number; failed: number }> {
  const { data, error } = await supabase.functions.invoke<{ made: number; failed: number }>(
    'make-product-pictures',
    { body: { productId, note: note?.trim() || undefined } },
  );
  if (!error && data) return data;
  let code = 'pictures_failed';
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null);
    if (body && typeof body.error === 'string') code = body.error;
  }
  throw new PicturesError(code);
}

export async function setPictureForAds(id: string, useInAds: boolean): Promise<void> {
  const { error } = await supabase
    .from('product_pictures')
    .update({ use_in_ads: useInAds })
    .eq('id', id);
  if (error) throw error;
}

export async function deletePicture(p: Pick<ProductPicture, 'id' | 'path'>): Promise<void> {
  const { error } = await supabase.from('product_pictures').delete().eq('id', p.id);
  if (error) throw error;
  await supabase.storage.from('product-images').remove([p.path]);
}

/**
 * The picture a design shows: the one it names (if ticked), else the main photo, else the
 * newest ticked picture (a product without a photo). Same rule as the export
 * (create_render_job).
 */
export function pictureFor(
  pictureId: string | null | undefined,
  pictures: ProductPicture[],
  mainUrl: string | null,
): { url: string | null; picture: ProductPicture | null } {
  const ticked = pictures.filter((p) => p.use_in_ads);
  const named = pictureId ? ticked.find((p) => p.id === pictureId) : undefined;
  if (named) return { url: named.url, picture: named };
  if (mainUrl) return { url: mainUrl, picture: null };
  const newest = ticked[0];
  return newest ? { url: newest.url, picture: newest } : { url: null, picture: null };
}

/** Short label shown on a look: which picture it uses. */
export function pictureTag(picture: ProductPicture | null, hasPhoto: boolean): string | null {
  if (picture?.kind === 'generated') return 'AI picture';
  if (picture?.kind === 'scene') return 'AI scene';
  return hasPhoto ? 'Your photo' : null;
}
