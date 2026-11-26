import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Tables, TablesUpdate } from '@/types/database';
import type { BriefValues } from './schemas';

export type Campaign = Tables<'campaigns'>;
export type CopyDrafts = {
  headlines: string[];
  captions: string[];
  hashtags: string[];
  provider: string;
};

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

export async function listCampaigns(workspaceId: string): Promise<Campaign[]> {
  return must(
    await supabase
      .from('campaigns')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false }),
  );
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  return check(await supabase.from('campaigns').select('*').eq('id', id).maybeSingle());
}

export async function createCampaign(
  ids: { workspaceId: string; businessId: string },
  values: BriefValues,
): Promise<Campaign> {
  return must(
    await supabase
      .from('campaigns')
      .insert({ ...values, workspace_id: ids.workspaceId, business_id: ids.businessId })
      .select()
      .single(),
  );
}

type Editable = Pick<
  TablesUpdate<'campaigns'>,
  | 'name'
  | 'goal'
  | 'product_id'
  | 'offer_text'
  | 'start_date'
  | 'end_date'
  | 'cta'
  | 'language'
  | 'outline_style'
  | 'headline'
  | 'caption'
  | 'hashtags'
>;

export async function updateCampaign(id: string, values: Editable): Promise<Campaign> {
  return must(await supabase.from('campaigns').update(values).eq('id', id).select().single());
}

export async function deleteCampaign(id: string) {
  check(await supabase.from('campaigns').delete().eq('id', id));
}

export async function confirmCampaignFacts(id: string) {
  check(await supabase.rpc('confirm_campaign_facts', { p_campaign_id: id }));
}

export class CopyError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

/** Asks the generate-copy Edge Function for drafts. Nothing is saved until the owner picks one. */
export async function generateCopy(campaignId: string): Promise<CopyDrafts> {
  const { data, error } = await supabase.functions.invoke<CopyDrafts>('generate-copy', {
    body: { campaignId },
  });
  if (error) {
    let code = 'generation_failed';
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      if (body && typeof body.error === 'string') code = body.error;
    }
    throw new CopyError(code);
  }
  return data!;
}
