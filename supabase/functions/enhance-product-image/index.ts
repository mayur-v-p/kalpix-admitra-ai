// enhance-product-image: makes an AI-enhanced version of a product's image for the owner to
// compare. Nothing changes on any ad until the owner chooses it (choose_product_image).
// POST { productId }  ->  { status: 'ready', provider }
import { createClient } from 'npm:@supabase/supabase-js@2';
import { extensionFor } from '../_shared/background-removal.ts';
import { json, preflight } from '../_shared/cors.ts';
import { getImageEnhancer } from '../_shared/image-enhancer.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PER_HOUR = 10;

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

  let productId: unknown;
  try {
    ({ productId } = await req.json());
  } catch {
    return json(req, { error: 'invalid_body' }, 400);
  }
  if (typeof productId !== 'string' || !UUID.test(productId))
    return json(req, { error: 'invalid_product_id' }, 400);

  const { data: product } = await asUser
    .from('products')
    .select(
      'id, workspace_id, image_path, cutout_path, cutout_status, enhanced_path, enhanced_status',
    )
    .eq('id', productId)
    .maybeSingle();
  if (!product) return json(req, { error: 'not_found' }, 404);
  if (!product.image_path) return json(req, { error: 'no_image' }, 422);
  if (product.enhanced_status === 'processing')
    return json(req, { error: 'already_processing' }, 409);

  const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: allowed, error: limitError } = await admin.rpc('consume_rate_limit', {
    p_key: `enhance:${product.workspace_id}`,
    p_max: MAX_PER_HOUR,
    p_window_seconds: 3600,
  });
  if (limitError) return json(req, { error: 'server_error' }, 500);
  if (!allowed) return json(req, { error: 'rate_limited' }, 429);

  // Enhance the clean cutout when there is one; otherwise the original photo.
  const source =
    product.cutout_status === 'ready' && product.cutout_path
      ? product.cutout_path
      : product.image_path;
  await admin
    .from('products')
    .update({ enhanced_status: 'processing', use_enhanced: false })
    .eq('id', product.id);

  let newPath: string | null = null;
  try {
    const { data: original, error: downloadError } = await admin.storage
      .from('product-images')
      .download(source);
    if (downloadError || !original) throw new Error('download failed');

    const enhancer = getImageEnhancer();
    const result = await enhancer.enhance(original);
    newPath = `${product.workspace_id}/enhanced/${product.id}-${crypto.randomUUID()}.${extensionFor(result.contentType)}`;
    const { error: uploadError } = await admin.storage
      .from('product-images')
      .upload(newPath, result.bytes, { contentType: result.contentType, upsert: false });
    if (uploadError) throw new Error('upload failed');

    // Saved only if the photo did not change meanwhile.
    const { data: saved } = await admin
      .from('products')
      .update({
        enhanced_path: newPath,
        enhanced_status: 'ready',
        enhanced_provider: result.provider,
      })
      .eq('id', product.id)
      .eq('image_path', product.image_path)
      .select('id')
      .maybeSingle();
    if (!saved) {
      await admin.storage.from('product-images').remove([newPath]);
      return json(req, { error: 'image_changed' }, 409);
    }
    if (product.enhanced_path && product.enhanced_path !== newPath) {
      await admin.storage.from('product-images').remove([product.enhanced_path]);
    }
    return json(req, { status: 'ready', provider: result.provider });
  } catch (error) {
    console.error(
      'enhance-product-image: failed',
      error instanceof Error ? error.message : 'unknown',
    );
    if (newPath) await admin.storage.from('product-images').remove([newPath]);
    await admin.from('products').update({ enhanced_status: 'failed' }).eq('id', product.id);
    return json(req, { error: 'enhance_failed' }, 502);
  }
});
