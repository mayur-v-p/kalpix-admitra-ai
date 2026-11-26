// generate-copy: draft headlines, captions and hashtags for a campaign.
// Same safety pattern as process-product-image: verify the JWT, read through the caller's
// RLS, rate-limit per workspace with the service role. It returns drafts only; the owner
// picks and edits one, and the browser saves it (AI output is always a draft).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCopywriter, guardCopy, type CopyInput } from '../_shared/copywriter.ts';
import { json, preflight } from '../_shared/cors.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PER_HOUR = 60;

const env = (...names: string[]) => {
  for (const n of names) {
    const v = Deno.env.get(n);
    if (v) return v;
  }
  throw new Error(`Missing environment variable ${names[0]}`);
};

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);

  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json(req, { error: 'unauthorized' }, 401);

  // Who is calling comes first: an unauthenticated caller learns nothing about the body rules.
  const url = env('SUPABASE_URL');
  const asUser = createClient(url, env('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await asUser.auth.getUser();
  if (userError || !userData.user) return json(req, { error: 'unauthorized' }, 401);

  let campaignId: unknown;
  try {
    ({ campaignId } = await req.json());
  } catch {
    return json(req, { error: 'invalid_body' }, 400);
  }
  if (typeof campaignId !== 'string' || !UUID.test(campaignId)) {
    return json(req, { error: 'invalid_campaign_id' }, 400);
  }

  // Only non-fact fields are read for the prompt: no price, offer, dates, phone or address.
  const { data: campaign } = await asUser
    .from('campaigns')
    .select(
      'id, workspace_id, goal, language, product_id, business:business_profiles(name, industry)',
    )
    .eq('id', campaignId)
    .maybeSingle();
  if (!campaign) return json(req, { error: 'not_found' }, 404);

  const [{ data: product }, { data: kit }] = await Promise.all([
    campaign.product_id
      ? asUser
          .from('products')
          .select('name, description')
          .eq('id', campaign.product_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    asUser
      .from('brand_kits')
      .select('tone')
      .eq('workspace_id', campaign.workspace_id)
      .maybeSingle(),
  ]);

  const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: allowed, error: limitError } = await admin.rpc('consume_rate_limit', {
    p_key: `copy:${campaign.workspace_id}`,
    p_max: MAX_PER_HOUR,
    p_window_seconds: 3600,
  });
  if (limitError) {
    console.error('generate-copy: rate limit check failed', limitError.code);
    return json(req, { error: 'server_error' }, 500);
  }
  if (!allowed) return json(req, { error: 'rate_limited' }, 429);

  const business = Array.isArray(campaign.business) ? campaign.business[0] : campaign.business;
  const input: CopyInput = {
    businessName: business?.name ?? 'Our shop',
    productName: product?.name ?? null,
    productDescription: product?.description ?? null,
    industry: business?.industry ?? 'other',
    goal: campaign.goal as CopyInput['goal'],
    language: campaign.language as CopyInput['language'],
    tone: kit?.tone ?? 'friendly',
  };

  try {
    const writer = getCopywriter();
    const drafts = guardCopy(await writer.write(input), input);
    return json(req, { ...drafts, provider: writer.name });
  } catch (error) {
    console.error('generate-copy: failed', error instanceof Error ? error.message : 'unknown');
    return json(req, { error: 'generation_failed' }, 502);
  }
});
