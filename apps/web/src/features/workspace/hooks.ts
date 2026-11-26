import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-context';
import { fetchWorkspaceBundle, signedUrl, type PrivateBucket } from './api';

export const workspaceKey = (userId: string | undefined) => ['workspace', userId] as const;

/** The signed-in user's workspace, business, location and brand kit. */
export function useWorkspace() {
  const { user } = useAuth();
  return useQuery({
    queryKey: workspaceKey(user?.id),
    queryFn: () => fetchWorkspaceBundle(user!.id),
    enabled: Boolean(user),
  });
}

/** Signed URL for a private brand asset, refreshed before the 10-minute link expires. */
export function useSignedUrl(
  path: string | null | undefined,
  bucket: PrivateBucket = 'brand-assets',
) {
  return useQuery({
    queryKey: ['signed-url', bucket, path],
    queryFn: () => signedUrl(path!, bucket),
    enabled: Boolean(path),
    staleTime: 8 * 60 * 1000,
  });
}
