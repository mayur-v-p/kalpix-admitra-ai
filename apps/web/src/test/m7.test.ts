import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHECKOUT_SRC, checkoutOptions, loadCheckout } from '@/features/billing/checkout';
import { billingErrorText, paiseToInr, type BillingErrorCode } from '@/features/billing/api';

type Razorpay = {
  verifyWebhook: (secret: string, raw: string, headers: Headers) => Promise<boolean>;
  validEventId: (id: string | null) => boolean;
  paymentNotes: (ref: string) => Record<string, string>;
  SIGNATURE_HEADER: string;
};
type Hmac = { signBody: (secret: string, body: string) => Promise<string> };
const rzPath = '@supabase-functions/_shared/razorpay.ts';
const hmacPath = '@supabase-functions/_shared/hmac.ts';
const rz = (await import(/* @vite-ignore */ rzPath)) as Razorpay;
const hmac = (await import(/* @vite-ignore */ hmacPath)) as Hmac;

// ---------------------------------------------------------------- webhook signature
describe('Razorpay webhook signature', () => {
  const secret = 'whsec_test_value';
  const raw = '{"entity":"event","event":"payment.captured","payload":{}}';
  const headers = (sig: string) => new Headers({ [rz.SIGNATURE_HEADER]: sig });

  it('accepts the HMAC-SHA256 hex of the exact raw body', async () => {
    const sig = await hmac.signBody(secret, raw);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    expect(await rz.verifyWebhook(secret, raw, headers(sig))).toBe(true);
  });

  it('refuses a changed body, a wrong secret, a missing signature or no secret', async () => {
    const sig = await hmac.signBody(secret, raw);
    expect(await rz.verifyWebhook(secret, raw.replace('captured', 'failed'), headers(sig))).toBe(
      false,
    );
    expect(await rz.verifyWebhook('other', raw, headers(sig))).toBe(false);
    expect(await rz.verifyWebhook(secret, raw, new Headers())).toBe(false);
    expect(await rz.verifyWebhook('', raw, headers(sig))).toBe(false);
  });

  it('refuses a re-formatted body (the raw bytes are signed, not the JSON)', async () => {
    const sig = await hmac.signBody(secret, raw);
    const pretty = JSON.stringify(JSON.parse(raw), null, 2);
    expect(await rz.verifyWebhook(secret, pretty, headers(sig))).toBe(false);
  });

  it('only accepts plain event ids', () => {
    expect(rz.validEventId('KXyuf0nQ4Mr3Vb')).toBe(true);
    expect(rz.validEventId(null)).toBe(false);
    expect(rz.validEventId("evt'; drop table")).toBe(false);
    expect(rz.validEventId('x'.repeat(101))).toBe(false);
  });

  it('sends Razorpay only our reference, no personal data', () => {
    expect(rz.paymentNotes('ref-1')).toEqual({ admitra_ref: 'ref-1' });
  });
});

// ---------------------------------------------------------------- checkout
describe('Razorpay Checkout', () => {
  const on = { submitted: () => {}, dismissed: () => {} };

  it('opens a subscription by id only: no amount from the browser', () => {
    const o = checkoutOptions(
      {
        kind: 'subscription',
        keyId: 'rzp_test_abc',
        subscriptionId: 'sub_123',
        description: 'Starter',
      },
      'a@example.com',
      on,
    );
    expect(o).toMatchObject({ key: 'rzp_test_abc', subscription_id: 'sub_123' });
    expect(o.amount).toBeUndefined();
    expect(o.order_id).toBeUndefined();
    expect(JSON.stringify(o)).not.toMatch(/secret/i);
  });

  it('opens an order with the amount the server returned', () => {
    const o = checkoutOptions(
      {
        kind: 'order',
        keyId: 'rzp_test_abc',
        orderId: 'order_1',
        amount: 9900,
        currency: 'INR',
        description: 'Pack',
      },
      undefined,
      on,
    );
    expect(o).toMatchObject({ order_id: 'order_1', amount: 9900, currency: 'INR' });
    expect(o.prefill).toBeUndefined();
  });

  afterEach(() => {
    document.head.querySelectorAll('script').forEach((s) => s.remove());
  });

  it('loads checkout.js from Razorpay once, only when asked', async () => {
    expect(document.querySelector(`script[src="${CHECKOUT_SRC}"]`)).toBeNull();
    const first = loadCheckout();
    const second = loadCheckout();
    const scripts = document.querySelectorAll(`script[src="${CHECKOUT_SRC}"]`);
    expect(scripts).toHaveLength(1);
    vi.stubGlobal('Razorpay', function Razorpay() {});
    scripts.item(0)?.dispatchEvent(new Event('load'));
    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();
    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------- copy
describe('billing copy', () => {
  it('has a message for every error code and shows rupees from paise', () => {
    const codes: BillingErrorCode[] = [
      'payments_not_configured',
      'not_owner',
      'already_subscribed',
      'unknown',
    ];
    for (const c of codes) expect(billingErrorText[c].length).toBeGreaterThan(10);
    expect(paiseToInr(39900)).toBe(399);
  });
});
