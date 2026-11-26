/**
 * Razorpay Checkout (https://checkout.razorpay.com/v1/checkout.js), loaded only when the
 * owner presses a pay button. The browser gets a subscription or order id from our Edge
 * Function and the public key id; it never sees a secret or decides an amount.
 *
 * The success callback is NOT trusted: it only sends the owner to the "confirming" page,
 * which waits for the signed webhook to update the database.
 */
export const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

type RazorpayOptions = {
  key: string;
  subscription_id?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  name: string;
  description: string;
  prefill?: { email?: string };
  notes?: Record<string, string>;
  theme?: { color: string };
  handler: () => void;
  modal: { ondismiss: () => void; confirm_close?: boolean };
};

type RazorpayInstance = {
  open(): void;
  on(event: 'payment.failed', cb: () => void): void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

let loading: Promise<void> | null = null;

export function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => (window.Razorpay ? resolve() : reject(new Error('checkout missing')));
    script.onerror = () => {
      script.remove();
      loading = null;
      reject(new Error('checkout failed to load'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export type CheckoutResult = 'submitted' | 'dismissed' | 'failed';

export type CheckoutTarget =
  | { kind: 'subscription'; keyId: string; subscriptionId: string; description: string }
  | {
      kind: 'order';
      keyId: string;
      orderId: string;
      amount: number;
      currency: string;
      description: string;
    };

/** Builds the Checkout options (no secrets, no prices of our own: Razorpay has them). */
export function checkoutOptions(
  target: CheckoutTarget,
  email: string | undefined,
  on: { submitted: () => void; dismissed: () => void },
): RazorpayOptions {
  return {
    key: target.keyId,
    ...(target.kind === 'subscription'
      ? { subscription_id: target.subscriptionId }
      : { order_id: target.orderId, amount: target.amount, currency: target.currency }),
    name: 'AdMitra AI',
    description: target.description,
    prefill: email ? { email } : undefined,
    theme: { color: '#1E1E1C' },
    handler: on.submitted,
    modal: { ondismiss: on.dismissed },
  };
}

/** Opens Checkout and resolves once the owner pays, closes the window, or the payment fails. */
export async function openCheckout(
  target: CheckoutTarget,
  email?: string,
): Promise<CheckoutResult> {
  await loadCheckout();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error('checkout missing');
  return new Promise<CheckoutResult>((resolve) => {
    let settled = false;
    let failed = false;
    const done = (r: CheckoutResult) => {
      if (settled) return;
      settled = true;
      resolve(r);
    };
    const rzp = new Razorpay(
      checkoutOptions(target, email, {
        submitted: () => done('submitted'),
        // Called when the window closes; after a failed attempt that counts as "failed".
        dismissed: () => done(failed ? 'failed' : 'dismissed'),
      }),
    );
    rzp.on('payment.failed', () => {
      failed = true;
    });
    rzp.open();
  });
}
