import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getClip, isClipWorking, listSceneTypes } from './api';

export const clipKey = (id: string | null | undefined) => ['ai-clip', id] as const;

export function useSceneTypes(industry: string | undefined) {
  return useQuery({
    queryKey: ['scene-types', industry],
    queryFn: () => listSceneTypes(industry!),
    enabled: Boolean(industry),
    staleTime: 60 * 60 * 1000,
  });
}

/** One clip; while it is being generated, updates arrive by Realtime with a slow poll fallback. */
export function useClip(id: string | null | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: clipKey(id),
    queryFn: () => getClip(id!),
    enabled: Boolean(id),
    refetchInterval: (q) => (isClipWorking(q.state.data) ? 3000 : false),
  });
  const working = isClipWorking(query.data);
  useEffect(() => {
    if (!id || !working) return;
    const channel = supabase
      .channel(`ai-clip-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ai_video_clips', filter: `id=eq.${id}` },
        () => void queryClient.invalidateQueries({ queryKey: clipKey(id) }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, working, queryClient]);
  return query;
}
