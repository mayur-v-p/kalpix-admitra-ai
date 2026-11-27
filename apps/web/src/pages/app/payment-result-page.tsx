import { CheckCircle2, XCircle } from 'lucide-react';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ButtonLink } from '@/components/ui/button';
import { site } from '@/config/site';
import { useRefreshBilling, useRefState } from '@/features/billing/hooks';
import { useWorkspace } from '@/features/workspace/hooks';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * /app/payment/success and /app/payment/failed.
 *
 * Razorpay's "success" in the browser proves nothing, so this page only WAITS: it shows
 * "Confirming your payment…" until the signed webhook has updated our database.
 */
export function PaymentResultPage({ outcome }: { outcome: 'success' | 'failed' }) {
  const [params] = useSearchParams();
  const raw = params.get('ref');
  const ref = raw && UUID.test(raw) ? raw : null;
  const ws = useWorkspace();
  const refresh = useRefreshBilling(ws.data?.workspace.id);
  const state = useRefState(outcome === 'success' ? ref : null);

  const confirmed = state.data === 'confirmed';
  useEffect(() => {
    if (confirmed) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh once, when confirmed
  }, [confirmed]);

  const failed = outcome === 'failed' || !ref || state.data === 'failed';

  return (
    <div className="mx-auto max-w-lg py-8 text-center" aria-live="polite">
      {failed ? (
        <>
          <XCircle className="mx-auto h-14 w-14 text-red-700" aria-hidden="true" />
          <h1 className="mt-4 text-3xl">Payment not completed</h1>
          <p className="mt-3 text-muted">
            Nothing was charged, or the payment did not go through. If money left your account, it
            is returned by your bank automatically, usually within 5–7 working days.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <ButtonLink to="/app/billing">Try again</ButtonLink>
            <ButtonLink to="/contact" variant="outline">
              Contact support
            </ButtonLink>
          </div>
          <p className="mt-4 text-sm text-muted">Or write to {site.supportEmail}</p>
        </>
      ) : confirmed ? (
        <>
          <CheckCircle2 className="mx-auto h-14 w-14 text-indigo-deep" aria-hidden="true" />
          <h1 className="mt-4 text-3xl">Payment confirmed</h1>
          <p className="mt-3 text-muted">
            Thank you! Your credits have been added and exports no longer carry the watermark.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <ButtonLink to="/app">Go to dashboard</ButtonLink>
            <ButtonLink to="/app/billing" variant="outline">
              See billing
            </ButtonLink>
          </div>
        </>
      ) : (
        <>
          <span
            className="mx-auto block h-12 w-12 animate-spin rounded-full border-2 border-line border-t-ink"
            aria-hidden="true"
          />
          <h1 className="mt-6 text-3xl">Confirming your payment…</h1>
          <p className="mt-3 text-muted" role="status">
            {state.timedOut
              ? 'This is taking longer than usual. Your payment is safe: credits appear on the billing page as soon as Razorpay confirms it.'
              : 'Waiting for Razorpay to confirm. This usually takes a few seconds.'}
          </p>
          {state.timedOut && (
            <ButtonLink to="/app/billing" className="mt-6">
              Go to billing
            </ButtonLink>
          )}
        </>
      )}
    </div>
  );
}
