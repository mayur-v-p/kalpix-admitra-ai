// razorpay-create-subscription: the owner chooses a monthly plan.
// POST { planId }  ->  { ref, subscriptionId, keyId }
//
// The browser sends ONLY the plan id. The user comes from the verified token, the workspace
// is the one they own, and the price is Razorpay's plan, linked in our `plans` table.
// Nothing is granted here: access and credits come only from the signed webhook.
import { billingError, caller, notConfigured, serviceClient } from '../_shared/billing.ts';
import { json, preflight } from '../_shared/cors.ts';
import {
  paymentNotes,
  razorpayKeys,
  razorpayPost,
  SUBSCRIPTION_TOTAL_COUNT,
} from '../_shared/razorpay.ts';

const PLAN = /^[a-z_]{2,30}$/;

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);

  const who = await caller(req);
  if (who instanceof Response) return who;

  let body: { planId?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: 'invalid_body' }, 400);
  }
  if (typeof body.planId !== 'string' || !PLAN.test(body.planId))
    return json(req, { error: 'invalid_plan' }, 422);

  const keys = razorpayKeys();
  if (!keys) return notConfigured(req);

  // Owner check, plan check, "not subscribed already" and rate limit, in the database.
  const admin = serviceClient();
  const { data: rows, error } = await admin.rpc('billing_prepare_subscription', {
    p_user: who.userId,
    p_plan: body.planId,
  });
  if (error) return billingError(req, error, 'create-subscription');
  const prepared = (rows as { ref: string; razorpay_plan_id: string }[])[0];

  try {
    const sub = await razorpayPost<{ id: string }>(keys, '/subscriptions', {
      plan_id: prepared.razorpay_plan_id,
      total_count: SUBSCRIPTION_TOTAL_COUNT,
      quantity: 1,
      customer_notify: true,
      notes: paymentNotes(prepared.ref),
    });
    const { error: attachError } = await admin.rpc('billing_attach', {
      p_ref: prepared.ref,
      p_razorpay_id: sub.id,
    });
    if (attachError) throw new Error('could not store the subscription id');
    return json(req, { ref: prepared.ref, subscriptionId: sub.id, keyId: keys.keyId });
  } catch (e) {
    console.error('create-subscription: failed', e instanceof Error ? e.message : 'unknown');
    await admin.rpc('billing_abandon', { p_ref: prepared.ref });
    return json(req, { error: 'payment_provider_error' }, 502);
  }
});
