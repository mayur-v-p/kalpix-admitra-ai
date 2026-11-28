// edit-design: "Change something" in the Studio. The owner says or types a change ("thoda
// festive banao", "bigger photo") and the AI art director returns the same design with only
// that change, plus a short list of what changed.
//
// - Logged-in members only (JWT + RLS reads), rate-limited per workspace.
// - The AI never changes facts: prices, offers, dates, phone and address are not in the design
//   at all, and a request to change them comes back as facts_request (design unchanged).
// - The website checks the returned design again (checkRecipe) before drawing or saving it.
// - Without OPENAI_API_KEY it answers 503 not_configured; the website then applies its own
//   simple edits for the suggestion buttons.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { json, preflight } from '../_shared/cors.ts';
import { loadDesignBrief } from '../_shared/design-brief.ts';
import {
  designFacts,
  EDIT_SCHEMA,
  editInstructions,
  scrubChanges,
  scrubDesign,
} from '../_shared/design-kit.ts';
import { openaiConfigured, openaiJson } from '../_shared/openai.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PER_HOUR = 60;
const MAX_REQUEST = 200;
const MAX_DESIGN_BYTES = 16000;

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

  let body: { campaignId?: unknown; design?: unknown; request?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: 'invalid_body' }, 400);
  }
  if (typeof body.campaignId !== 'string' || !UUID.test(body.campaignId)) {
    return json(req, { error: 'invalid_campaign_id' }, 400);
  }
  const request = typeof body.request === 'string' ? body.request.trim() : '';
  if (!request || request.length > MAX_REQUEST) return json(req, { error: 'invalid_request' }, 400);
  if (!body.design || typeof body.design !== 'object' || Array.isArray(body.design)) {
    return json(req, { error: 'invalid_design' }, 400);
  }
  const current = JSON.stringify(body.design);
  if (current.length > MAX_DESIGN_BYTES) return json(req, { error: 'invalid_design' }, 400);

  const loaded = await loadDesignBrief(asUser, body.campaignId);
  if (!loaded) return json(req, { error: 'not_found' }, 404);
  if (!openaiConfigured()) return json(req, { error: 'not_configured' }, 503);

  const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: allowed, error: limitError } = await admin.rpc('consume_rate_limit', {
    p_key: `edit:${loaded.workspaceId}`,
    p_max: MAX_PER_HOUR,
    p_window_seconds: 3600,
  });
  if (limitError) {
    console.error('edit-design: rate limit check failed', limitError.code);
    return json(req, { error: 'server_error' }, 500);
  }
  if (!allowed) return json(req, { error: 'rate_limited' }, 429);

  const { brief } = loaded;
  try {
    const out = await openaiJson<{
      design: Record<string, unknown>;
      changes: unknown;
      facts_request: boolean;
    }>({
      name: 'design_edit',
      schema: EDIT_SCHEMA,
      system: editInstructions(brief),
      user: JSON.stringify({
        business: JSON.parse(designFacts(brief)),
        current_design: body.design,
        owner_request: request,
      }),
      timeoutMs: 40000,
      temperature: 0.4,
      maxTokens: 6000,
    });
    if (out.facts_request === true) {
      return json(req, { factsRequest: true, design: null, changes: [], provider: 'openai' });
    }
    const own = [brief.businessName, brief.productName ?? ''];
    return json(req, {
      factsRequest: false,
      design: scrubDesign(out.design ?? {}, own),
      changes: scrubChanges(out.changes),
      provider: 'openai',
    });
  } catch (error) {
    console.error('edit-design: failed', error instanceof Error ? error.message : 'unknown');
    return json(req, { error: 'edit_failed' }, 502);
  }
});
