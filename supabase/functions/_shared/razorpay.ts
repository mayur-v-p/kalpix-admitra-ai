// Razorpay REST API, called with fetch and Basic auth.
//
// The official Node SDK is not used: it depends on Node's http module and does not run
// cleanly in Deno Edge Functions. The API is small, so plain fetch is simpler and easier to
// review. Docs checked Nov 2026: Subscriptions API, Orders API, webhook validation
// (HMAC-SHA256 hex of the raw body, x-razorpay-signature, x-razorpay-event-id).
//
// Secrets (Supabase Edge Function secrets only, never in the browser):
//   RAZORPAY_KEY_ID          also given to the browser to open Checkout (safe to show)
//   RAZORPAY_KEY_SECRET      server only
//   RAZORPAY_WEBHOOK_SECRET  server only; set the same value in the Razorpay dashboard
//   RAZORPAY_ACCOUNT_ID      optional: webhooks for any other account are refused
import { verifySignature } from './hmac.ts';

export const RAZORPAY_API = 'https://api.razorpay.com/v1';
export const SIGNATURE_HEADER = 'x-razorpay-signature';
export const EVENT_ID_HEADER = 'x-razorpay-event-id';

/** Monthly subscriptions run for up to 10 years unless cancelled. */
export const SUBSCRIPTION_TOTAL_COUNT = 120;

export type RazorpayKeys = { keyId: string; keySecret: string };

/** The API keys, or null when payments are not set up yet (no keys typed in). */
export function razorpayKeys(): RazorpayKeys | null {
  const keyId = Deno.env.get('RAZORPAY_KEY_ID') ?? '';
  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET') ?? '';
  if (!/^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId) || !keySecret) return null;
  return { keyId, keySecret };
}

/** Thrown when Razorpay refuses a request. Carries only the HTTP status, never the body. */
export class RazorpayError extends Error {
  constructor(readonly status: number) {
    super(`Razorpay request failed (${status})`);
  }
}

export async function razorpayPost<T>(
  keys: RazorpayKeys,
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${RAZORPAY_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${keys.keyId}:${keys.keySecret}`)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    await res.body?.cancel();
    throw new RazorpayError(res.status);
  }
  return (await res.json()) as T;
}

/** True only if the webhook really comes from Razorpay (signature over the raw body). */
export function verifyWebhook(secret: string, rawBody: string, headers: Headers) {
  return verifySignature(secret, rawBody, headers.get(SIGNATURE_HEADER));
}

/** Event ids look like evt_...; anything else is refused before it reaches the database. */
export function validEventId(id: string | null): id is string {
  return !!id && /^[A-Za-z0-9_-]{6,100}$/.test(id);
}

/** Notes Razorpay keeps with the payment: ids only, never personal data. */
export function paymentNotes(ref: string) {
  return { admitra_ref: ref };
}
