import { useQuery } from '@tanstack/react-query';
import { downloadUrl, listJobAssets } from '@/features/exports/api';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type JobSummary = Pick<
  Tables<'generation_jobs'>,
  'id' | 'campaign_id' | 'status' | 'progress' | 'created_at'
>;

export const workspaceJobsKey = (workspaceId: string | undefined) =>
  ['workspace-jobs', workspaceId] as const;

/** The workspace's export jobs, newest first (RLS: members only). */
export function useWorkspaceJobs(workspaceId: string | undefined) {
  return useQuery({
    queryKey: workspaceJobsKey(workspaceId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('generation_jobs')
        .select('id, campaign_id, status, progress, created_at')
        .eq('workspace_id', workspaceId!)
        .eq('type', 'render')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as JobSummary[];
    },
    enabled: Boolean(workspaceId),
    // Keep "Making video" moving while a render runs.
    refetchInterval: (q) =>
      (q.state.data ?? []).some((j) => j.status === 'QUEUED' || j.status === 'PROCESSING')
        ? 5000
        : false,
  });
}

export type AdStatus = 'ready' | 'making' | 'draft' | 'failed';

/** Each campaign's latest export, and what that means for the owner. */
export function adStatuses(jobs: JobSummary[] | undefined) {
  const latest = new Map<string, JobSummary>();
  const ready = new Map<string, JobSummary>();
  for (const j of jobs ?? []) {
    if (!j.campaign_id) continue;
    if (!latest.has(j.campaign_id)) latest.set(j.campaign_id, j);
    if (j.status === 'COMPLETED' && !ready.has(j.campaign_id)) ready.set(j.campaign_id, j);
  }
  const status = (campaignId: string): AdStatus => {
    const j = latest.get(campaignId);
    if (!j) return 'draft';
    if (j.status === 'QUEUED' || j.status === 'PROCESSING') return 'making';
    if (ready.has(campaignId)) return 'ready';
    return j.status === 'FAILED' || j.status === 'CANCELLED' ? 'failed' : 'draft';
  };
  return { latest, ready, status };
}

/** The finished video of a ready ad (9:16 first), as a short-lived download link. */
export async function videoLink(jobId: string, campaignName: string): Promise<string | null> {
  const assets = await listJobAssets(jobId);
  const videos = assets.filter((a) => a.kind === 'mp4');
  const pick = videos.find((a) => a.format === '9:16') ?? videos[0];
  return pick ? downloadUrl(pick, campaignName) : null;
}

/**
 * Shares the video on the phone's share sheet (WhatsApp, Instagram, ...) where the browser can
 * share files; otherwise downloads it.
 */
export async function shareVideo(url: string, title: string) {
  try {
    const blob = await (await fetch(url)).blob();
    const file = new File([blob], `${title.replace(/[^\w\- ]+/g, '').trim() || 'kalpix-ad'}.mp4`, {
      type: 'video/mp4',
    });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return;
    }
  } catch {
    // fall through to a download
  }
  window.open(url, '_blank', 'noopener');
}
