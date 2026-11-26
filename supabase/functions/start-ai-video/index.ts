// start-ai-video: the owner picks a scene for a product; reuse the cached clip or start one.
// POST { productId, sceneTypeId, mode? }  ->  { clipId, status, cached }
//
// Order: verify the JWT -> read the product AS THE USER (RLS proves membership) ->
// reserve_ai_clip (cache, rate limit, credits, one transaction) -> submit to the provider ->
// mark submitted. If the provider refuses, the clip FAILS and its credits come back.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildScenePrompt, getVideoProvider } from '../_shared/ai-video.ts';
import { json, preflight } from '../_shared/cors.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SCENE = /^[a-z_]{3,40}$/;

const env = (...names: string[]) => {
  for (const n of names) {
    const v = Deno.env.get(n);
    if (v) return v;
  }
  throw new Error(`Missing environment variable ${names[0]}`);
};

const reserveErrors: Record<string, number> = {
  insufficient_credits: 402,
  rate_limited: 429,
  invalid_scene: 422,
  invalid_mode: 422,
  no_image: 422,
  trial_cached_only: 403, // free try: only scenes already made
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

  let body: { productId?: unknown; sceneTypeId?: unknown; mode?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: 'invalid_body' }, 400);
  }
  const { productId, sceneTypeId } = body;
  const mode = body.mode ?? 'composite';
  if (typeof productId !== 'string' || !UUID.test(productId))
    return json(req, { error: 'invalid_product_id' }, 400);
  if (typeof sceneTypeId !== 'string' || !SCENE.test(sceneTypeId))
    return json(req, { error: 'invalid_scene' }, 400);
  if (mode !== 'composite' && mode !== 'animated_product')
    return json(req, { error: 'invalid_mode' }, 400);

  // Membership check through RLS: a product of another business is simply not found.
  const { data: product } = await asUser
    .from('products')
    .select('id')
    .eq('id', productId)
    .maybeSingle();
  if (!product) return json(req, { error: 'not_found' }, 404);

  const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const provider = getVideoProvider();

  const { data: rows, error: reserveError } = await admin.rpc('reserve_ai_clip', {
    p_user: userData.user.id,
    p_product_id: productId,
    p_scene_type_id: sceneTypeId,
    p_mode: mode,
    p_provider: provider.name,
    p_model: provider.model,
  });
  if (reserveError) {
    const status = reserveErrors[reserveError.message];
    if (status) return json(req, { error: reserveError.message }, status);
    if (reserveError.code === 'P0002') return json(req, { error: 'not_found' }, 404);
    console.error('start-ai-video: reserve failed', reserveError.code);
    return json(req, { error: 'server_error' }, 500);
  }
  const clip = (
    rows as {
      clip_id: string;
      cached: boolean;
      clip_status: string;
      prompt_template: string;
      product_name: string;
    }[]
  )[0];
  if (!clip) return json(req, { error: 'server_error' }, 500);
  if (clip.cached)
    return json(req, { clipId: clip.clip_id, status: clip.clip_status, cached: true });

  try {
    const { data: source } = await admin
      .from('ai_video_clips')
      .select('source_image_path')
      .eq('id', clip.clip_id)
      .single();
    const { data: signed, error: signError } = await admin.storage
      .from('product-images')
      .createSignedUrl(source!.source_image_path, 60 * 60);
    if (signError || !signed) throw new Error('image link failed');

    const { providerJobId } = await provider.submit({
      prompt: buildScenePrompt(clip.prompt_template, clip.product_name),
      imageUrl: signed.signedUrl,
      aspectRatio: '9:16',
      mode,
      callbackUrl: `${url}/functions/v1/ai-video-webhook`,
    });
    await admin.rpc('mark_ai_clip_submitted', {
      p_clip: clip.clip_id,
      p_provider_job_id: providerJobId,
    });
    return json(req, {
      clipId: clip.clip_id,
      status: 'PROCESSING',
      cached: false,
      provider: provider.name,
    });
  } catch (error) {
    console.error(
      'start-ai-video: submit failed',
      error instanceof Error ? error.message : 'unknown',
    );
    await admin.rpc('fail_ai_clip', {
      p_clip: clip.clip_id,
      p_error: 'The scene could not be started.',
    });
    return json(req, { error: 'generation_failed' }, 502);
  }
});
