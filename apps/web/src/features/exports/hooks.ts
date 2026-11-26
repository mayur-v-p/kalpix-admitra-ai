import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getCreditBalance, getQrCode, isActive, listCampaignJobs, listJobAssets } from './api';

export const creditsKey = (workspaceId: string | undefined) => ['credits', workspaceId] as const;
export const jobsKey = (campaignId: string | undefined) => ['render-jobs', campaignId] as const;

export function useCredits(workspaceId: string | undefined) {
  return useQuery({
    queryKey: creditsKey(workspaceId),
    queryFn: () => getCreditBalance(workspaceId!),
    enabled: Boolean(workspaceId),
  });
}

export function useQrCode(campaignId: string | undefined) {
  return useQuery({
    queryKey: ['qr-code', campaignId],
    queryFn: () => getQrCode(campaignId!),
    enabled: Boolean(campaignId),
    staleTime: Infinity,
  });
}

/**
 * The campaign's latest exports. While one is running, progress arrives through Realtime
 * (RLS-checked) with a slow poll as a fallback.
 */
export function useCampaignJobs(campaignId: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: jobsKey(campaignId),
    queryFn: () => listCampaignJobs(campaignId!),
    enabled: Boolean(campaignId),
    refetchInterval: (q) => (q.state.data?.some(isActive) ? 4000 : false),
  });
  const running = query.data?.some(isActive) ?? false;

  useEffect(() => {
    if (!campaignId || !running) return;
    const channel = supabase
      .channel(`render-jobs-${campaignId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'generation_jobs',
          filter: `campaign_id=eq.${campaignId}`,
        },
        () => void queryClient.invalidateQueries({ queryKey: jobsKey(campaignId) }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [campaignId, running, queryClient]);

  return query;
}

export function useJobAssets(jobId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['job-assets', jobId],
    queryFn: () => listJobAssets(jobId!),
    enabled: Boolean(jobId) && enabled,
    staleTime: Infinity,
  });
}
