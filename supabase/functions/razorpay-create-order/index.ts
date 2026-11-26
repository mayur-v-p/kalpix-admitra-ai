// razorpay-create-order: the owner buys a one-time pack (for example the festival pack).
// POST { packId }  ->  { ref, orderId, amount, currency, keyId }
//
// The amount comes from our `credit_packs` table, never from the browser. The pack's credits
// are granted only when the signed webhook reports the payment captured.
import { billingError, caller, notConfigured, serviceClient } from '../_shared/billing.ts';
import { json, preflight } from '../_shared/cors.ts';
import { paymentNotes, razorpayKeys, razorpayPost } from '../_shared/razorpay.ts';

const PACK = /^[a-z_]{2,30}$/;

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);

  const who = await caller(req);
  if (who instanceof Response) return who;

  let body: { packId?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: 'invalid_body' }, 400);
  }
  if (typeof body.packId !== 'string' || !PACK.test(body.packId))
    return json(req, { error: 'invalid_pack' }, 422);

  const keys = razorpayKeys();
  if (!keys) return notConfigured(req);

  const admin = serviceClient();
  const { data: rows, error } = await admin.rpc('billing_prepare_order', {
    p_user: who.userId,
    p_pack: body.packId,
  });
  if (error) return billingError(req, error, 'create-order');
  const prepared = (rows as { ref: string; amount: number; currency: string }[])[0];

  try {
    const order = await razorpayPost<{ id: string; amount: number; currency: string }>(
      keys,
      '/orders',
      {
        amount: prepared.amount, // paise, from our table
        currency: prepared.currency,
        receipt: prepared.ref, // 36 characters; Razorpay allows 40
        notes: paymentNotes(prepared.ref),
      },
    );
    if (order.amount !== prepared.amount || order.currency !== prepared.currency)
      throw new Error('order amount does not match');
    const { error: attachError } = await admin.rpc('billing_attach', {
      p_ref: prepared.ref,
      p_razorpay_id: order.id,
    });
    if (attachError) throw new Error('could not store the order id');
    return json(req, {
      ref: prepared.ref,
      orderId: order.id,
      amount: prepared.amount,
      currency: prepared.currency,
      keyId: keys.keyId,
    });
  } catch (e) {
    console.error('create-order: failed', e instanceof Error ? e.message : 'unknown');
    await admin.rpc('billing_abandon', { p_ref: prepared.ref });
    return json(req, { error: 'payment_provider_error' }, 502);
  }
});
