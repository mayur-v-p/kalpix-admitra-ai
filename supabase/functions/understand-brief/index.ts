// understand-brief: reads what the owner said ("Speak your ad") with an LLM and returns the
// ad details for the "Check your ad" screen.
//
// - Logged-in callers only (JWT verified), rate-limited per user.
// - Without OPENAI_API_KEY it answers 503 not_configured, and the website uses its own
//   rule-based parser instead. The website also falls back on any error or timeout.
// - Nothing is saved here. Every value goes back to the owner to check, edit and confirm.
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  BRIEF_SCHEMA,
  briefInstructions,
  checkBrief,
  indiaToday,
} from '../_shared/brief-check.ts';
import { json, preflight } from '../_shared/cors.ts';
import { openaiConfigured, openaiJson } from '../_shared/openai.ts';

const MAX_PER_HOUR = 30;
const MAX_TEXT = 600;

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

  let text: unknown;
  let products: unknown;
  try {
    ({ text, products } = await req.json());
  } catch {
    return json(req, { error: 'invalid_body' }, 400);
  }
  if (typeof text !== 'string' || !text.trim() || text.length > MAX_TEXT) {
    return json(req, { error: 'invalid_text' }, 400);
  }
  // Product names are only hints for matching; they are capped and cleaned.
  const names = (Array.isArray(products) ? products : [])
    .filter((p): p is string => typeof p === 'string')
    .map((p) => p.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, 50);

  if (!openaiConfigured()) return json(req, { error: 'not_configured' }, 503);

  const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: allowed, error: limitError } = await admin.rpc('consume_rate_limit', {
    p_key: `brief:${userData.user.id}`,
    p_max: MAX_PER_HOUR,
    p_window_seconds: 3600,
  });
  if (limitError) {
    console.error('understand-brief: rate limit check failed', limitError.code);
    return json(req, { error: 'server_error' }, 500);
  }
  if (!allowed) return json(req, { error: 'rate_limited' }, 429);

  const today = indiaToday();
  try {
    const raw = await openaiJson<unknown>({
      name: 'ad_brief',
      schema: BRIEF_SCHEMA,
      system: briefInstructions(today, names),
      user: `The owner said: ${JSON.stringify(text.trim())}`,
      timeoutMs: 15000,
    });
    return json(req, { brief: checkBrief(raw, today), provider: 'openai' });
  } catch (error) {
    // Only the error code is logged, never what the owner said.
    console.error('understand-brief: failed', error instanceof Error ? error.message : 'unknown');
    return json(req, { error: 'understanding_failed' }, 502);
  }
});
