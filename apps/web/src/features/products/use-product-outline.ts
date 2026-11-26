import { traceImageUrl, type Outline } from '@admitra/styles-engine';
import { useQuery } from '@tanstack/react-query';

/**
 * The product's traced outline for Outline Highlight. Keyed by the storage path (not the signed URL,
 * which changes every few minutes), so each photo is traced once. Returns null when no clear
 * product shape is found; the template then frames the photo instead. The render worker traces
 * with the same function, so the exported video matches the preview.
 */
export function useProductOutline(
  url: string | null | undefined,
  storagePath: string | null | undefined,
) {
  return useQuery<Outline | null>({
    queryKey: ['product-outline', storagePath],
    enabled: Boolean(url && storagePath),
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: false,
    queryFn: () => traceImageUrl(url!),
  });
}
