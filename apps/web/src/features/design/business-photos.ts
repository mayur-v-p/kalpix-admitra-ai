import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type BusinessPhoto = Tables<'business_photos'> & { url: string | null };

export const businessPhotosKey = (businessId: string | undefined) =>
  ['business-photos', businessId] as const;

const BUCKET = 'product-images';
const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Photos of the business with short-lived signed links (the bucket is private). */
export async function listBusinessPhotos(businessId: string): Promise<BusinessPhoto[]> {
  const { data, error } = await supabase
    .from('business_photos')
    .select('*')
    .eq('business_id', businessId)
    .order('is_main', { ascending: false })
    .order('created_at');
  if (error) throw error;
  const rows = data ?? [];
  if (!rows.length) return [];
  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(
    rows.map((r) => r.path),
    60 * 60,
  );
  return rows.map((r, i) => ({ ...r, url: signed?.[i]?.signedUrl ?? null }));
}

export function useBusinessPhotos(businessId: string | undefined) {
  return useQuery({
    queryKey: businessPhotosKey(businessId),
    queryFn: () => listBusinessPhotos(businessId!),
    enabled: Boolean(businessId),
    staleTime: 30 * 60_000,
  });
}

/** Uploads a photo into the workspace's own folder and records it. */
export async function addBusinessPhoto(
  business: { id: string; workspace_id: string },
  file: File,
  label: string | null,
) {
  if (!TYPES.includes(file.type)) throw new Error('Please choose a JPG, PNG or WebP photo.');
  if (file.size > MAX_BYTES) throw new Error('Please choose a photo under 10 MB.');
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${business.workspace_id}/business/${crypto.randomUUID()}.${ext}`;
  const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
  if (up.error) throw new Error('The photo could not be uploaded.');
  const { error } = await supabase.from('business_photos').insert({
    workspace_id: business.workspace_id,
    business_id: business.id,
    path,
    label: label?.trim().slice(0, 40) || null,
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(
      error.message.includes('photo_limit')
        ? 'You can keep up to 12 photos.'
        : 'The photo could not be saved.',
    );
  }
}

export async function setMainBusinessPhoto(photoId: string) {
  const { error } = await supabase.rpc('set_main_business_photo', { p_photo_id: photoId });
  if (error) throw error;
}

export async function deleteBusinessPhoto(photo: BusinessPhoto) {
  const { error } = await supabase.from('business_photos').delete().eq('id', photo.id);
  if (error) throw error;
  await supabase.storage.from(BUCKET).remove([photo.path]);
}
