// AI video providers behind one small interface (architecture.md 5.1/5.2). Pick one with the
// AI_VIDEO_PROVIDER secret.
//
//   mock (default, TEST MODE): no real video. It "finishes" a few seconds later by calling our
//        own ai-video-webhook with a properly signed event, so the full flow (credits, cache,
//        webhook signature, de-duplication, owner review, export) runs for real. The ad then
//        shows the scene type's code-drawn stand-in instead of a video clip.
//
// A real provider (e.g. an image-to-video API) implements VideoProvider: submit() sends the
// product image + prompt, verify()/parse() handle its webhook. Its output is then downloaded
// and normalised by the media worker (ai_clip job), which is connected with the provider.
// Prompts never contain prices, phone numbers, dates, addresses, text or logos.

export type SubmitInput = {
  prompt: string;
  imageUrl: string;
  aspectRatio: '9:16' | '16:9';
  mode: 'composite' | 'animated_product';
  callbackUrl: string;
};

export type WebhookEvent = {
  eventId: string;
  providerJobId: string;
  status: 'succeeded' | 'failed';
  /** Real providers: where to download the clip. Absent for the test-mode stand-in. */
  videoUrl?: string;
  error?: string;
};

export interface VideoProvider {
  readonly name: string;
  readonly model: string;
  submit(input: SubmitInput): Promise<{ providerJobId: string }>;
  /** True only if the webhook really comes from this provider. */
  verify(rawBody: string, headers: Headers): Promise<boolean>;
  parse(rawBody: string): WebhookEvent;
}

export const SIGNATURE_HEADER = 'x-admitra-signature';

async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time comparison, so the signature can't be guessed byte by byte. */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signBody(secret: string, body: string) {
  return hmacHex(secret, body);
}

export async function verifySignature(secret: string, body: string, signature: string | null) {
  if (!secret || !signature) return false;
  return safeEqual(await hmacHex(secret, body), signature);
}

const webhookSecret = () => Deno.env.get('AI_VIDEO_WEBHOOK_SECRET') ?? '';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const mock: VideoProvider = {
  name: 'mock',
  model: 'mock-scene-1',
  async submit(input) {
    const secret = webhookSecret();
    if (!secret) throw new Error('AI_VIDEO_WEBHOOK_SECRET is not set');
    const providerJobId = `mock_${crypto.randomUUID()}`;
    const body = JSON.stringify({
      event_id: `evt_${crypto.randomUUID()}`,
      job_id: providerJobId,
      status: 'succeeded',
    });
    const deliver = (async () => {
      await new Promise((r) => setTimeout(r, 4000)); // "generation" time
      const signature = await signBody(secret, body);
      await fetch(input.callbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', [SIGNATURE_HEADER]: signature },
        body,
      });
    })().catch((e) =>
      console.error('mock video: callback failed', e instanceof Error ? e.message : e),
    );
    if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(deliver);
    return { providerJobId };
  },
  verify: (rawBody, headers) =>
    verifySignature(webhookSecret(), rawBody, headers.get(SIGNATURE_HEADER)),
  parse(rawBody) {
    const b = JSON.parse(rawBody);
    if (typeof b.event_id !== 'string' || typeof b.job_id !== 'string')
      throw new Error('bad event');
    return {
      eventId: b.event_id,
      providerJobId: b.job_id,
      status: b.status === 'succeeded' ? 'succeeded' : 'failed',
      videoUrl: typeof b.video_url === 'string' ? b.video_url : undefined,
      error: typeof b.error === 'string' ? b.error.slice(0, 200) : undefined,
    };
  },
};

const providers: Record<string, VideoProvider> = { mock };

export function getVideoProvider(): VideoProvider {
  const name = Deno.env.get('AI_VIDEO_PROVIDER') ?? 'mock';
  const provider = providers[name];
  if (!provider) throw new Error(`Unknown AI_VIDEO_PROVIDER "${name}"`);
  return provider;
}

/**
 * The prompt for a scene: the scene type's template with the product name. The name is cleaned
 * to letters (with their vowel signs) and spaces, so no price, number, link or instruction can ride along.
 */
export function buildScenePrompt(template: string, productName: string | null) {
  const name =
    (productName ?? '')
      .normalize('NFKC')
      .replace(/[^\p{L}\p{M}\s'-]/gu, ' ') // \p{M}: Devanagari vowel signs
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60) || 'the product';
  return template.replaceAll('{product}', name);
}
