import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';
import type { ProductFormValues } from './schemas';

export type Product = Tables<'products'>;

function check<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data;
}
function must<T>(result: { data: T; error: unknown }): NonNullable<T> {
  if (result.error) throw result.error;
  if (result.data === null || result.data === undefined)
    throw new Error('The database returned no row.');
  return result.data;
}

/** Active products of a workspace, newest first. RLS limits this to the user's workspaces. */
export async function listProducts(workspaceId: string): Promise<Product[]> {
  return must(
    await supabase
      .from('products')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('archived_at', null)
      .order('created_at', { ascending: false }),
  );
}

export async function getProduct(id: string): Promise<Product | null> {
  return check(await supabase.from('products').select('*').eq('id', id).maybeSingle());
}

const ext: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/** Uploads an original photo to "{workspace}/originals/<random>.ext". Originals are never overwritten. */
export async function uploadProductPhoto(workspaceId: string, file: File): Promise<string> {
  const path = `${workspaceId}/originals/${crypto.randomUUID()}.${ext[file.type] ?? 'jpg'}`;
  check(
    await supabase.storage
      .from('product-images')
      .upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false }),
  );
  return path;
}

async function removeImages(paths: Array<string | null | undefined>) {
  const list = paths.filter((p): p is string => Boolean(p));
  if (list.length) await supabase.storage.from('product-images').remove(list);
}

export async function createProduct(
  ids: { workspaceId: string; businessId: string },
  values: ProductFormValues,
  photo: File | null,
): Promise<Product> {
  const image_path = photo ? await uploadProductPhoto(ids.workspaceId, photo) : null;
  try {
    return must(
      await supabase
        .from('products')
        .insert({
          workspace_id: ids.workspaceId,
          business_id: ids.businessId,
          name: values.name,
          description: values.description,
          price: values.price,
          image_path,
        })
        .select()
        .single(),
    );
  } catch (error) {
    await removeImages([image_path]); // don't leave an orphaned upload behind
    throw error;
  }
}

export async function updateProduct(
  product: Product,
  values: ProductFormValues,
  photo: File | null,
): Promise<Product> {
  const image_path = photo
    ? await uploadProductPhoto(product.workspace_id, photo)
    : product.image_path;
  try {
    const updated = must(
      await supabase
        .from('products')
        .update({
          name: values.name,
          description: values.description,
          price: values.price,
          image_path,
        })
        .eq('id', product.id)
        .select()
        .single(),
    );
    // A new photo replaces the old original and cutout.
    if (photo) await removeImages([product.image_path, product.cutout_path]);
    return updated;
  } catch (error) {
    if (photo) await removeImages([image_path]);
    throw error;
  }
}

export async function deleteProduct(product: Product) {
  check(await supabase.from('products').delete().eq('id', product.id));
  await removeImages([product.image_path, product.cutout_path]);
}

export class CutoutError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

/** Asks the Edge Function to make the background-free cutout. */
export async function requestCutout(productId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('process-product-image', {
    body: { productId },
  });
  if (!error) return;
  let code = 'processing_failed';
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null);
    if (body && typeof body.error === 'string') code = body.error;
  }
  throw new CutoutError(code);
}

export async function requestEnhancedImage(productId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('enhance-product-image', {
    body: { productId },
  });
  if (!error) return;
  let code = 'enhance_failed';
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null);
    if (body && typeof body.error === 'string') code = body.error;
  }
  throw new CutoutError(code);
}

/** The owner's choice between the AI-enhanced image and the original. */
export async function chooseProductImage(productId: string, useEnhanced: boolean): Promise<void> {
  check(
    await supabase.rpc('choose_product_image', {
      p_product_id: productId,
      p_use_enhanced: useEnhanced,
    }),
  );
}

export async function confirmProductPrice(productId: string): Promise<void> {
  check(await supabase.rpc('confirm_product_price', { p_product_id: productId }));
}

export async function confirmBusinessPhone(businessId: string): Promise<void> {
  check(await supabase.rpc('confirm_business_phone', { p_business_id: businessId }));
}

export async function confirmLocation(locationId: string): Promise<void> {
  check(await supabase.rpc('confirm_location', { p_location_id: locationId }));
}
