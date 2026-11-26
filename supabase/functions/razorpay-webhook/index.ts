// razorpay-webhook: Razorpay reports subscription and payment events here.
//
// This is the ONLY place that grants paid access or credits. It is public by design
// (verify_jwt = false, because Razorpay calls it), so it trusts nothing unsigned:
//  1. the HMAC-SHA256 signature is checked over the RAW body before anything is read;
//  2. the event id header is required;
//  3. the database function process_razorpay_event then, in one transaction, records the
//     event id (a repeat does nothing), checks the amount against our own price and grants
//     credits at most once per Razorpay payment.
// If the database step fails we answer 500 and keep nothing, so Razorpay sends the event
// again. Responses carry no internal details, and the payload (which holds the customer's
// email and phone) is never logged or stored.
import { serviceClient } from '../_shared/billing.ts';
import { EVENT_ID_HEADER, validEventId, verifyWebhook } from '../_shared/razorpay.ts';

const reply = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);

  const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') ?? '';
  if (!secret) return reply({ error: 'not_configured' }, 503);

  const raw = await req.text();
  if (raw.length > 100_000) return reply({ error: 'too_large' }, 413);
  if (!(await verifyWebhook(secret, raw, req.headers)))
    return reply({ error: 'invalid_signature' }, 400);

  const eventId = req.headers.get(EVENT_ID_HEADER);
  if (!validEventId(eventId)) return reply({ error: 'missing_event_id' }, 400);

  let event: { event?: unknown; account_id?: unknown };
  try {
    event = JSON.parse(raw);
  } catch {
    return reply({ error: 'invalid_body' }, 400);
  }
  if (typeof event.event !== 'string') return reply({ error: 'invalid_body' }, 400);

  // Optional: refuse events for any other Razorpay account.
  const account = Deno.env.get('RAZORPAY_ACCOUNT_ID');
  if (account && event.account_id !== account) return reply({ ok: true, ignored: 'account' });

  const { data: outcome, error } = await serviceClient().rpc('process_razorpay_event', {
    p_event_id: eventId,
    p_event: event,
  });
  if (error) {
    console.error('razorpay-webhook: not processed', event.event, error.code);
    return reply({ error: 'server_error' }, 500); // Razorpay retries
  }
  if (outcome === 'amount_mismatch' || outcome === 'plan_mismatch')
    console.error('razorpay-webhook: check by hand', event.event, outcome, eventId);
  return reply({ ok: true, outcome });
});
