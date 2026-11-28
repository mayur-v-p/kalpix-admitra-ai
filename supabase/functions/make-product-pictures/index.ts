// make-product-pictures: three new AI pictures of a product for its ads.
//   - With the owner's photo: the SAME product placed in three new scenes (kind 'scene').
//   - Without a photo: three realistic pictures made from the product's name and the owner's
//     optional description (kind 'generated'; ads using one say "Image for representation
//     only").
// The owner ticks which pictures ads may use; each design in "Pick a look" can use a different
// one. POST { productId, note? }  ->  { made, failed }
//
// - Logged-in members (free try included, with a lower limit), rate-limited per workspace.
// - Only the photo, the product name and description and the owner's note go to OpenAI: never
//   prices, phone numbers, addresses or other facts.
// - Without OPENAI_API_KEY it answers 503 not_configured.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { json, preflight } from '../_shared/cors.ts';
import { openaiConfigured, openaiJson } from '../_shared/openai.ts';
import { editImage, generateImage, KEEP_PRODUCT, PICTURE_RULES } from '../_shared/openai-images.ts';
import {
  checkIdeas,
  IDEAS_SCHEMA,
  ideasFacts,
  ideasInstructions,
  type PictureBrief,
} from '../_shared/picture-ideas.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PER_CALL = 3;
const MAX_PICTURES = 12;
const MAX_PER_HOUR = 6;
const MAX_PER_HOUR_TRY = 2;
const MAX_PHOTO_BYTES = 8_000_000;

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
  const isTry = userData.user.is_anonymous === true;

  let body: { productId?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: 'invalid_body' }, 400);
  }
  if (typeof body.productId !== 'string' || !UUID.test(body.productId)) {
    return json(req, { error: 'invalid_product_id' }, 400);
  }
  const note =
    typeof body.note === 'string' && body.note.trim()
      ? body.note
          .replace(/[\u0000-\u001f\u007f<>{}]/g, '')
          .trim()
          .slice(0, 160)
      : null;

  // RLS: only members of the product's workspace can read it.
  const { data: product } = await asUser
    .from('products')
    .select('id, workspace_id, business_id, name, description, image_path')
    .eq('id', body.productId)
    .maybeSingle();
  if (!product) return json(req, { error: 'not_found' }, 404);
  if (!openaiConfigured()) return json(req, { error: 'not_configured' }, 503);

  const [{ data: business }, { data: existing }] = await Promise.all([
    asUser
      .from('business_profiles')
      .select('name, industry')
      .eq('id', product.business_id)
      .maybeSingle(),
    asUser.from('product_pictures').select('label').eq('product_id', product.id),
  ]);
  if ((existing?.length ?? 0) + PER_CALL > MAX_PICTURES) {
    return json(req, { error: 'picture_limit' }, 409);
  }

  const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: allowed, error: limitError } = await admin.rpc('consume_rate_limit', {
    p_key: `pictures:${product.workspace_id}`,
    p_max: isTry ? MAX_PER_HOUR_TRY : MAX_PER_HOUR,
    p_window_seconds: 3600,
  });
  if (limitError) {
    console.error('make-product-pictures: rate limit check failed', limitError.code);
    return json(req, { error: 'server_error' }, 500);
  }
  if (!allowed) return json(req, { error: 'rate_limited' }, 429);

  // The owner's original photo (never the price or other facts).
  let photo: Blob | null = null;
  if (product.image_path) {
    const { data } = await admin.storage.from('product-images').download(product.image_path);
    if (data && data.size <= MAX_PHOTO_BYTES) photo = data;
  }

  const brief: PictureBrief = {
    productName: product.name,
    productDescription: product.description?.slice(0, 300) ?? null,
    businessName: business?.name ?? '',
    sector: business?.industry ?? 'other',
    note,
    hasPhoto: Boolean(photo),
    avoid: (existing ?? [])
      .map((e) => e.label)
      .filter((l): l is string => Boolean(l))
      .slice(-9),
  };

  let ideas;
  try {
    const raw = await openaiJson<unknown>({
      name: 'picture_ideas',
      schema: IDEAS_SCHEMA,
      system: ideasInstructions(brief, PER_CALL),
      user: ideasFacts(brief),
      timeoutMs: 20000,
      temperature: 1,
      maxTokens: 3000,
    });
    ideas = checkIdeas(raw, PER_CALL, brief.hasPhoto);
  } catch (error) {
    console.error(
      'make-product-pictures: ideas failed',
      error instanceof Error ? error.message : '',
    );
    ideas = checkIdeas(null, PER_CALL, brief.hasPhoto);
  }

  const what = [brief.productName, brief.productDescription, note].filter(Boolean).join(', ');
  const results = await Promise.allSettled(
    ideas.map(async (idea) => {
      const picture = photo
        ? await editImage(
            photo,
            `Advertising photo: place this exact product ${idea.scene}. ${KEEP_PRODUCT} ${PICTURE_RULES}`,
          )
        : await generateImage(
            `Realistic advertising photo of ${what}, as sold by an Indian ${brief.sector.replace('_', ' ')} business: ${idea.scene}. ${PICTURE_RULES}`,
          );
      const path = `${product.workspace_id}/pictures/${product.id}-${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await admin.storage
        .from('product-images')
        .upload(path, picture.bytes, { contentType: picture.contentType, upsert: false });
      if (uploadError) throw new Error('upload failed');
      const { error: insertError } = await admin.from('product_pictures').insert({
        workspace_id: product.workspace_id,
        product_id: product.id,
        path,
        kind: photo ? 'scene' : 'generated',
        label: idea.label,
        provider: picture.provider,
      });
      if (insertError) {
        await admin.storage.from('product-images').remove([path]);
        throw new Error(`insert failed ${insertError.code}`);
      }
    }),
  );
  const failed = results.filter((r) => r.status === 'rejected');
  for (const f of failed) {
    console.error(
      'make-product-pictures: picture failed',
      (f as PromiseRejectedResult).reason instanceof Error
        ? (f as PromiseRejectedResult).reason.message
        : 'unknown',
    );
  }
  const made = results.length - failed.length;
  if (!made) return json(req, { error: 'pictures_failed' }, 502);
  return json(req, { made, failed: failed.length });
});
