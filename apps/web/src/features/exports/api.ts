import type { Aspect } from '@admitra/styles-engine';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type RenderJob = Tables<'generation_jobs'>;
export type CreativeAsset = Tables<'creative_assets'>;
export type CreditBalance = Tables<'credit_balances'>;

/** Mirrors private.render_cost in the database (the database is the authority). */
export const CREDITS_PER_SIZE = 1;

export const ACTIVE_STATUSES = ['CREATED', 'QUEUED', 'PROCESSING'] as const;
export const isActive = (job: Pick<RenderJob, 'status'> | null | undefined) =>
  Boolean(job && (ACTIVE_STATUSES as readonly string[]).includes(job.status));

/** Stable error codes raised by public.create_render_job. */
export type ExportErrorCode =
  | 'facts_not_confirmed'
  | 'insufficient_credits'
  | 'export_in_progress'
  | 'rate_limited'
  | 'invalid_formats'
  | 'clip_not_approved'
  | 'export_failed';

export class ExportError extends Error {
  constructor(
    public code: ExportErrorCode,
    public detail: string | null = null,
  ) {
    super(code);
  }
}

const KNOWN: ExportErrorCode[] = [
  'facts_not_confirmed',
  'insufficient_credits',
  'export_in_progress',
  'rate_limited',
  'invalid_formats',
  'clip_not_approved',
];

/** Reserves credits, snapshots the confirmed facts and queues the render, in one transaction. */
export async function createRenderJob(campaignId: string, formats: Aspect[]): Promise<string> {
  const { data, error } = await supabase.rpc('create_render_job', {
    p_campaign_id: campaignId,
    p_formats: formats,
  });
  if (error) {
    const code = KNOWN.find((k) => k === error.message) ?? 'export_failed';
    throw new ExportError(code, error.details ?? null);
  }
  return data as string;
}

export async function listCampaignJobs(campaignId: string): Promise<RenderJob[]> {
  const { data, error } = await supabase
    .from('generation_jobs')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) throw error;
  return data;
}

export async function listJobAssets(jobId: string): Promise<CreativeAsset[]> {
  const { data, error } = await supabase
    .from('creative_assets')
    .select('*')
    .eq('job_id', jobId)
    .order('format');
  if (error) throw error;
  return data;
}

export async function getCreditBalance(workspaceId: string): Promise<CreditBalance | null> {
  const { data, error } = await supabase
    .from('credit_balances')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getQrCode(campaignId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('qr_links')
    .select('code')
    .eq('campaign_id', campaignId)
    .maybeSingle();
  if (error) throw error;
  return data?.code ?? null;
}

/** The link inside the ad's QR code (the qr-redirect Edge Function). */
export function qrUrlFor(code: string | null | undefined): string | null {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!code || !base) return null;
  return `${base.replace(/\/$/, '')}/functions/v1/qr-redirect?c=${code}`;
}

/** A 5-minute link that downloads the file with a friendly name. Storage RLS decides access. */
export async function downloadUrl(asset: CreativeAsset, fileName: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('renders')
    .createSignedUrl(asset.path, 300, { download: fileName });
  if (error || !data) throw error ?? new Error('No download link');
  return data.signedUrl;
}
