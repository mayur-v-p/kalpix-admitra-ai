// design-ad: the AI art director. Looks at the ad's photo and returns several different design
// recipes for a campaign (the website scores them and shows the best three).
//
// - Logged-in members only (JWT + RLS reads), rate-limited per workspace.
// - The model sees the business, product, purpose and the photo, and only WHETHER there is an
//   offer or price; never the price, offer, dates, phone or address themselves.
// - Without OPENAI_API_KEY it answers 503 not_configured; the website then uses its own
//   "surprise" designer, so the feature works with no key.
// - Nothing is saved here: the owner picks a look in the Studio.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { json, preflight } from '../_shared/cors.ts';
import { loadDesignBrief } from '../_shared/design-brief.ts';
import {
  DESIGN_SCHEMA,
  designFacts,
  designInstructions,
  scrubDesign,
  scrubPhoto,
} from '../_shared/design-kit.ts';
import { openaiConfigured, openaiJson } from '../_shared/openai.ts';
import { photoForAi } from '../_shared/photo.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PER_HOUR = 40;

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
  const url = env('SUPABASE_URL');
  const asUser = createClient(url, env('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await asUser.auth.getUser();
  if (userError || !userData.user) return json(req, { error: 'unauthorized' }, 401);

  let body: { campaignId?: unknown; count?: unknown; avoid?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: 'invalid_body' }, 400);
  }
  if (typeof body.campaignId !== 'string' || !UUID.test(body.campaignId)) {
    return json(req, { error: 'invalid_campaign_id' }, 400);
  }
  const count =
    typeof body.count === 'number' && Number.isInteger(body.count)
      ? Math.min(6, Math.max(1, body.count))
      : 6;
  const avoid = (Array.isArray(body.avoid) ? body.avoid : [])
    .filter((a): a is string => typeof a === 'string')
    .map((a) => a.slice(0, 30))
    .slice(0, 12);

  const loaded = await loadDesignBrief(asUser, body.campaignId, avoid);
  if (!loaded) return json(req, { error: 'not_found' }, 404);
  if (!openaiConfigured()) return json(req, { error: 'not_configured' }, 503);

  const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: allowed, error: limitError } = await admin.rpc('consume_rate_limit', {
    p_key: `design:${loaded.workspaceId}`,
    p_max: MAX_PER_HOUR,
    p_window_seconds: 3600,
  });
  if (limitError) {
    console.error('design-ad: rate limit check failed', limitError.code);
    return json(req, { error: 'server_error' }, 500);
  }
  if (!allowed) return json(req, { error: 'rate_limited' }, 429);

  const { brief } = loaded;
  const photo = await photoForAi(asUser, loaded.visionPath);
  try {
    const out = await openaiJson<{ photo: unknown; designs: Record<string, unknown>[] }>({
      name: 'ad_designs',
      schema: DESIGN_SCHEMA,
      system: designInstructions(brief, count),
      user: designFacts(brief),
      images: photo ? [photo] : undefined,
      timeoutMs: 75000,
      temperature: 1,
      maxTokens: 16000,
    });
    const own = [brief.businessName, brief.productName ?? ''];
    const designs = (out.designs ?? []).slice(0, count).map((d) => scrubDesign(d, own));
    if (!designs.length) throw new Error('no_designs');
    return json(req, {
      designs,
      photo: photo ? scrubPhoto(out.photo) : null,
      provider: 'openai',
    });
  } catch (error) {
    console.error('design-ad: failed', error instanceof Error ? error.message : 'unknown');
    return json(req, { error: 'design_failed' }, 502);
  }
});
