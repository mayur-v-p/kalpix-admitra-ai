// razorpay-cancel-subscription: the owner cancels their plan.
// POST {}  ->  { cancelled: true, atPeriodEnd }
//
// An active plan is cancelled at the end of the month already paid (the owner keeps what they
// paid for). One that never started charging is cancelled straight away. Our status changes
// when Razorpay's signed subscription.cancelled webhook arrives.
import { billingError, caller, notConfigured, serviceClient } from '../_shared/billing.ts';
import { json, preflight } from '../_shared/cors.ts';
import { razorpayKeys, razorpayPost } from '../_shared/razorpay.ts';

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);

  const who = await caller(req);
  if (who instanceof Response) return who;

  const keys = razorpayKeys();
  if (!keys) return notConfigured(req);

  const admin = serviceClient();
  const { data: rows, error } = await admin.rpc('billing_prepare_cancel', { p_user: who.userId });
  if (error) return billingError(req, error, 'cancel-subscription');
  const sub = (
    rows as { ref: string; razorpay_subscription_id: string; subscription_status: string }[]
  )[0];

  const atPeriodEnd = sub.subscription_status === 'active';
  try {
    await razorpayPost(
      keys,
      `/subscriptions/${encodeURIComponent(sub.razorpay_subscription_id)}/cancel`,
      {
        cancel_at_cycle_end: atPeriodEnd ? 1 : 0,
      },
    );
  } catch (e) {
    console.error('cancel-subscription: failed', e instanceof Error ? e.message : 'unknown');
    return json(req, { error: 'payment_provider_error' }, 502);
  }
  await admin.rpc('billing_mark_cancel', { p_ref: sub.ref, p_user: who.userId });
  return json(req, { cancelled: true, atPeriodEnd });
});
