// ai-video-webhook: the video provider reports a finished (or failed) clip.
//
// Public by design (verify_jwt = false), because the provider calls it. It trusts nothing
// unsigned: the HMAC signature is checked over the raw body before anything is read, each
// event id is processed once (webhook_events), and the clip is found only by the provider's
// own job id. Responses carry no internal details.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getVideoProvider } from '../_shared/ai-video.ts';

const env = (...names: string[]) => {
  for (const n of names) {
    const v = Deno.env.get(n);
    if (v) return v;
  }
  throw new Error(`Missing environment variable ${names[0]}`);
};

const reply = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
  const raw = await req.text();
  if (raw.length > 20_000) return reply({ error: 'too_large' }, 413);

  const provider = getVideoProvider();
  if (!(await provider.verify(raw, req.headers))) return reply({ error: 'invalid_signature' }, 401);

  let event;
  try {
    event = provider.parse(raw);
  } catch {
    return reply({ error: 'invalid_body' }, 400);
  }

  const admin = createClient(
    env('SUPABASE_URL'),
    env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  // Each event once: a repeat (provider retry) is acknowledged and ignored.
  const { error: dupError } = await admin
    .from('webhook_events')
    .insert({ source: 'ai_video', event_id: event.eventId });
  if (dupError) {
    if (dupError.code === '23505') return reply({ ok: true, duplicate: true });
    console.error('ai-video-webhook: event not recorded', dupError.code);
    return reply({ error: 'server_error' }, 500); // the provider retries
  }

  const { data: clip } = await admin
    .from('ai_video_clips')
    .select('id')
    .eq('provider', provider.name)
    .eq('provider_job_id', event.providerJobId)
    .maybeSingle();
  if (!clip) return reply({ ok: true, unknown_job: true });

  // If processing fails, forget the event so the provider's retry is handled, not ignored.
  const forget = async (why: string, code?: string) => {
    console.error('ai-video-webhook: not processed', why, code);
    await admin
      .from('webhook_events')
      .delete()
      .eq('source', 'ai_video')
      .eq('event_id', event.eventId);
    return reply({ error: 'server_error' }, 500); // the provider retries
  };

  let result;
  if (event.status === 'failed') {
    result = await admin.rpc('fail_ai_clip', {
      p_clip: clip.id,
      p_error: 'The AI scene could not be generated.',
    });
  } else if (event.videoUrl) {
    // Real clips are downloaded and normalised by the media worker (ai_clip job), which is
    // connected together with a real provider. Until then, fail safely and return the credits.
    result = await admin.rpc('fail_ai_clip', {
      p_clip: clip.id,
      p_error: 'Video download is not connected yet.',
    });
  } else {
    // Test mode: the code-drawn stand-in for the scene type; 5 s like a real master clip.
    result = await admin.rpc('ai_clip_ready', {
      p_clip: clip.id,
      p_file_path: null,
      p_poster_path: null,
      p_duration: 5,
    });
  }
  if (result.error) return forget('clip update failed', result.error.code);

  await admin
    .from('webhook_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('source', 'ai_video')
    .eq('event_id', event.eventId);
  return reply({ ok: true });
});
