// process-product-image: makes the background-free cutout of a product photo.
//
// Flow (architecture.md 4.6 + security baseline):
//   1. Verify the caller's JWT with Supabase Auth (no anonymous calls).
//   2. Read the product with the CALLER's token, so row-level security proves they are a
//      member of its workspace. Nothing from the request body is trusted beyond the id.
//   3. Rate-limit per workspace, then use the service-role client only for the privileged
//      steps: reading the original, writing the cutout and the cutout columns.
// Errors return a stable code; details go to the server log without secrets or URLs.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { extensionFor, getBackgroundRemover } from '../_shared/background-removal.ts';
import { json, preflight } from '../_shared/cors.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PER_HOUR = 30; // cutouts per workspace per hour

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

  let productId: unknown;
  try {
    ({ productId } = await req.json());
  } catch {
    return json(req, { error: 'invalid_body' }, 400);
  }
  if (typeof productId !== 'string' || !UUID.test(productId)) {
    return json(req, { error: 'invalid_product_id' }, 400);
  }

  const url = env('SUPABASE_URL');
  const anonKey = env('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY');

  // 1-2. Caller-scoped client: RLS decides what this user may see.
  const asUser = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await asUser.auth.getUser();
  if (userError || !userData.user) return json(req, { error: 'unauthorized' }, 401);

  const { data: product, error: readError } = await asUser
    .from('products')
    .select('id, workspace_id, image_path, cutout_path, cutout_status')
    .eq('id', productId)
    .maybeSingle();
  if (readError) {
    console.error('process-product-image: read failed', readError.code);
    return json(req, { error: 'server_error' }, 500);
  }
  if (!product) return json(req, { error: 'not_found' }, 404);
  if (!product.image_path) return json(req, { error: 'no_image' }, 422);
  if (product.cutout_status === 'processing')
    return json(req, { error: 'already_processing' }, 409);

  // 3. Privileged work. The service-role client never trusts request data: the paths come
  // from the product row, and a CHECK constraint keeps them inside the workspace folder.
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: allowed, error: limitError } = await admin.rpc('consume_rate_limit', {
    p_key: `cutout:${product.workspace_id}`,
    p_max: MAX_PER_HOUR,
    p_window_seconds: 3600,
  });
  if (limitError) {
    console.error('process-product-image: rate limit check failed', limitError.code);
    return json(req, { error: 'server_error' }, 500);
  }
  if (!allowed) return json(req, { error: 'rate_limited' }, 429);

  await admin
    .from('products')
    .update({ cutout_status: 'processing', cutout_error: null })
    .eq('id', product.id);

  let newPath: string | null = null;
  try {
    const { data: original, error: downloadError } = await admin.storage
      .from('product-images')
      .download(product.image_path);
    if (downloadError || !original) throw new Error('download failed');

    const remover = getBackgroundRemover();
    const cutout = await remover.remove(original);

    newPath = `${product.workspace_id}/cutouts/${product.id}-${crypto.randomUUID()}.${extensionFor(cutout.contentType)}`;
    const { error: uploadError } = await admin.storage
      .from('product-images')
      .upload(newPath, cutout.bytes, { contentType: cutout.contentType, upsert: false });
    if (uploadError) throw new Error('upload failed');

    // Commit only if the photo did not change while we worked.
    const { data: saved } = await admin
      .from('products')
      .update({ cutout_path: newPath, cutout_status: 'ready', cutout_provider: cutout.provider })
      .eq('id', product.id)
      .eq('image_path', product.image_path)
      .select('id')
      .maybeSingle();
    if (!saved) {
      await admin.storage.from('product-images').remove([newPath]);
      return json(req, { error: 'image_changed' }, 409);
    }

    if (product.cutout_path && product.cutout_path !== newPath) {
      await admin.storage.from('product-images').remove([product.cutout_path]);
    }
    return json(req, { status: 'ready', provider: cutout.provider });
  } catch (error) {
    console.error(
      'process-product-image: failed',
      error instanceof Error ? error.message : 'unknown',
    );
    if (newPath) await admin.storage.from('product-images').remove([newPath]);
    await admin
      .from('products')
      .update({
        cutout_status: 'failed',
        cutout_error: 'Could not process this photo. Please try again.',
      })
      .eq('id', product.id)
      .eq('image_path', product.image_path);
    return json(req, { error: 'processing_failed' }, 502);
  }
});
