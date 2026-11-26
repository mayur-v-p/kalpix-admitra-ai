import { Check } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-field';
import { useAuth } from '@/features/auth/auth-context';
import {
  BillingError,
  billingErrorText,
  paiseToInr,
  startPackOrder,
  startSubscription,
  type BillingErrorCode,
  type PackRow,
  type PlanRow,
} from '@/features/billing/api';
import { openCheckout, type CheckoutTarget } from '@/features/billing/checkout';
import {
  useBillingStatus,
  useCancelSubscription,
  useLedger,
  usePacks,
  usePayments,
  usePlans,
} from '@/features/billing/hooks';
import { useCredits } from '@/features/exports/hooks';
import { useWorkspace } from '@/features/workspace/hooks';
import { cn, formatInr } from '@/lib/utils';
import { PageError, PageHeader, PageLoading } from './page-state';

const dateFmt = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const formatDate = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : '');

const statusText: Record<string, string> = {
  active: 'Active',
  authenticated: 'Starting: waiting for the first payment',
  pending: 'Payment retrying: please check your UPI or card',
  halted: 'Paused: payments failed',
  cancelled: 'Cancelled',
  completed: 'Ended',
  paused: 'Paused',
};

const paymentStatusText: Record<string, string> = {
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
  created: 'Started',
};

/** + adds to available credits, − takes from them; a reserved credit being spent changes neither. */
const ledgerSign: Record<string, string> = {
  grant: '+',
  release: '+',
  reserve: '−',
  refund: '−',
  adjust: '−',
};

const ledgerText: Record<string, string> = {
  grant: 'Added',
  reserve: 'Reserved for an export',
  consume: 'Spent (from reserved)',
  release: 'Returned (export failed)',
  refund: 'Removed (payment refunded)',
  adjust: 'Adjusted',
};

export function BillingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const ws = useWorkspace();
  const workspaceId = ws.data?.workspace.id;
  // A free try (anonymous user) cannot buy: the payment functions refuse it too.
  const isOwner = ws.data?.role === 'owner' && !user?.is_anonymous;
  const status = useBillingStatus(workspaceId);
  const credits = useCredits(workspaceId);
  const plans = usePlans();
  const packs = usePacks();
  const payments = usePayments(workspaceId);
  const ledger = useLedger(workspaceId);
  const cancel = useCancelSubscription(workspaceId);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<BillingErrorCode | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (ws.isLoading || status.isLoading) return <PageLoading />;
  if (ws.isError || !ws.data || status.isError || !status.data)
    return (
      <PageError
        onRetry={() => {
          void ws.refetch();
          void status.refetch();
        }}
      />
    );

  const s = status.data;
  const onPaidPlan = s.planId !== 'free';
  const canCancel =
    isOwner &&
    !s.cancelAtPeriodEnd &&
    ['active', 'authenticated', 'pending', 'halted'].includes(s.subscriptionStatus ?? '');
  const wanted = params.get('plan');

  /** Server creates the subscription/order -> Razorpay Checkout -> the webhook decides. */
  async function pay(key: string, start: () => Promise<{ ref: string; target: CheckoutTarget }>) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const { ref, target } = await start();
      let result;
      try {
        result = await openCheckout(target, user?.email);
      } catch {
        throw new BillingError('checkout_unavailable');
      }
      if (result === 'submitted') navigate(`/app/payment/success?ref=${ref}`);
      else if (result === 'failed') navigate(`/app/payment/failed?ref=${ref}`);
      else setNotice('The payment window was closed. Nothing was charged.');
    } catch (e) {
      setError(e instanceof BillingError ? e.code : 'unknown');
    } finally {
      setBusy(null);
    }
  }

  const choosePlan = (plan: PlanRow) =>
    pay(plan.id, async () => {
      const r = await startSubscription(plan.id);
      return {
        ref: r.ref,
        target: {
          kind: 'subscription',
          keyId: r.keyId,
          subscriptionId: r.subscriptionId,
          description: `${plan.name} plan, ${formatInr(plan.price_inr)} a month`,
        },
      };
    });

  const buyPack = (pack: PackRow) =>
    pay(pack.id, async () => {
      const r = await startPackOrder(pack.id);
      return {
        ref: r.ref,
        target: {
          kind: 'order',
          keyId: r.keyId,
          orderId: r.orderId,
          amount: r.amount,
          currency: r.currency,
          description: pack.name,
        },
      };
    });

  const onCancel = async () => {
    setError(null);
    try {
      const r = await cancel.mutateAsync();
      setConfirmCancel(false);
      setNotice(
        r.atPeriodEnd
          ? `Your plan is cancelled. You keep it until ${formatDate(s.periodEnd)}; you will not be charged again.`
          : 'Your plan is cancelled. You will not be charged.',
      );
    } catch (e) {
      setError(e instanceof BillingError ? e.code : 'unknown');
    }
  };

  const paidPlans = (plans.data ?? []).filter((p) => p.price_inr > 0);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Billing"
        title="Plan and credits"
        intro="Pay with UPI Autopay, cards or netbanking through Razorpay. Credits are added once Razorpay confirms the payment."
      />

      <div className="flex flex-col gap-4" aria-live="polite">
        {error && <FormMessage tone="error">{billingErrorText[error]}</FormMessage>}
        {notice && <FormMessage tone="info">{notice}</FormMessage>}
        {user?.is_anonymous && (
          <FormMessage tone="info">
            Save your free try as an account first (Account page), then you can choose a plan.
          </FormMessage>
        )}
        {!isOwner && !user?.is_anonymous && (
          <FormMessage tone="info">
            Only the owner of this business account can change the plan or buy packs.
          </FormMessage>
        )}
      </div>

      {/* Current plan */}
      <section
        aria-labelledby="current-plan"
        className="mt-6 grid gap-6 rounded-2xl border border-line bg-card p-6 shadow-soft md:grid-cols-[1fr_auto]"
      >
        <div>
          <h2
            id="current-plan"
            className="text-sm font-medium tracking-[0.2em] text-muted uppercase"
          >
            Current plan
          </h2>
          <p className="mt-2 font-display text-3xl tracking-[0.12em] uppercase">{s.planName}</p>
          {s.subscriptionStatus && (
            <p className="mt-1 text-muted">
              {s.cancelAtPeriodEnd
                ? `Cancelled: active until ${formatDate(s.periodEnd)}`
                : `${statusText[s.subscriptionStatus] ?? s.subscriptionStatus}${
                    s.periodEnd && s.subscriptionStatus === 'active'
                      ? ` · renews ${formatDate(s.periodEnd)}`
                      : ''
                  }`}
            </p>
          )}
          <p className="mt-3 text-base">
            {s.watermark
              ? 'Exports carry the “Made with Kalpix” watermark.'
              : 'Exports have no watermark.'}
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 md:items-end">
          <p className="text-sm font-medium tracking-[0.2em] text-muted uppercase">Credits</p>
          <p className="font-display text-4xl font-light">{credits.data?.available ?? 0}</p>
          {(credits.data?.reserved ?? 0) > 0 && (
            <p className="text-sm text-muted">{credits.data?.reserved} reserved for exports</p>
          )}
        </div>
        {canCancel && (
          <div className="border-t border-line pt-4 md:col-span-2">
            {confirmCancel ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <p className="flex-1">
                  Cancel {s.planName}?{' '}
                  {s.subscriptionStatus === 'active'
                    ? `You keep it until ${formatDate(s.periodEnd)} and won't be charged again.`
                    : "You won't be charged."}
                </p>
                <Button variant="dark" onClick={onCancel} disabled={cancel.isPending}>
                  {cancel.isPending ? 'Cancelling…' : 'Yes, cancel'}
                </Button>
                <Button variant="outline" onClick={() => setConfirmCancel(false)}>
                  Keep my plan
                </Button>
              </div>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmCancel(true)}>
                Cancel plan
              </Button>
            )}
          </div>
        )}
      </section>

      {/* Plans */}
      <section aria-labelledby="plans" className="mt-10">
        <h2 id="plans" className="text-xl uppercase md:text-2xl">
          Monthly plans
        </h2>
        {plans.isLoading ? (
          <PageLoading />
        ) : (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {paidPlans.map((plan) => {
              const current = s.planId === plan.id;
              return (
                <article
                  key={plan.id}
                  className={cn(
                    'flex flex-col rounded-2xl border bg-card p-6 shadow-soft',
                    wanted === plan.id || current ? 'border-ink ring-1 ring-ink' : 'border-line',
                  )}
                >
                  <h3 className="font-display text-xl tracking-[0.15em] uppercase">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted">{plan.audience}</p>
                  <p className="mt-4 flex items-baseline gap-1">
                    <span className="font-display text-3xl font-light">
                      {formatInr(plan.price_inr)}
                    </span>
                    <span className="text-muted">/ month</span>
                  </p>
                  <ul className="mt-4 flex flex-1 flex-col gap-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex gap-2.5">
                        <Check
                          className="mt-1 h-4 w-4 shrink-0 text-sage-deep"
                          aria-hidden="true"
                        />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="mt-6 w-full"
                    variant={current ? 'outline' : 'primary'}
                    disabled={!isOwner || onPaidPlan || busy !== null}
                    onClick={() => void choosePlan(plan)}
                  >
                    {current
                      ? 'Your plan'
                      : busy === plan.id
                        ? 'Opening Razorpay…'
                        : `Choose ${plan.name}`}
                  </Button>
                </article>
              );
            })}
          </div>
        )}
        {onPaidPlan && (
          <p className="mt-3 text-sm text-muted">
            To switch plans, cancel this one first; the new plan can start when it ends.
          </p>
        )}
      </section>

      {/* One-time packs */}
      {(packs.data ?? []).map((pack) => (
        <section
          key={pack.id}
          aria-label={pack.name}
          className="mt-8 flex flex-col gap-5 rounded-2xl border border-line bg-lamp-soft p-6 md:flex-row md:items-center md:justify-between"
        >
          <div>
            <p className="font-display text-2xl tracking-[0.12em] uppercase">
              {pack.name} · {formatInr(pack.price_inr)}
            </p>
            <p className="mt-2 max-w-xl text-ink/80">{pack.description}</p>
          </div>
          <Button
            variant="dark"
            className="w-full md:w-auto"
            disabled={!isOwner || busy !== null}
            onClick={() => void buyPack(pack)}
          >
            {busy === pack.id ? 'Opening Razorpay…' : `Buy for ${formatInr(pack.price_inr)}`}
          </Button>
        </section>
      ))}

      {/* History */}
      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="payments" className="min-w-0">
          <h2 id="payments" className="text-xl uppercase">
            Payments
          </h2>
          {payments.data?.length ? (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-card">
              <table className="w-full min-w-[22rem] text-left">
                <thead className="border-b border-line text-sm text-muted">
                  <tr>
                    <th className="p-3 font-medium">Date</th>
                    <th className="p-3 font-medium">For</th>
                    <th className="p-3 font-medium">Amount</th>
                    <th className="p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {payments.data.map((p) => (
                    <tr key={p.id}>
                      <td className="p-3">{formatDate(p.paid_at ?? p.created_at)}</td>
                      <td className="p-3">
                        {p.kind === 'pack'
                          ? (packs.data?.find((k) => k.id === p.pack_id)?.name ?? 'Pack')
                          : `${plans.data?.find((x) => x.id === p.plan_id)?.name ?? ''} plan`}
                      </td>
                      <td className="p-3">{formatInr(paiseToInr(p.amount))}</td>
                      <td className="p-3">{paymentStatusText[p.status] ?? p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-muted">No payments yet.</p>
          )}
          <p className="mt-3 text-sm text-muted">
            GST invoices will be available here once our GSTIN is registered with Razorpay.
          </p>
        </section>

        <section aria-labelledby="credit-history" className="min-w-0">
          <h2 id="credit-history" className="text-xl uppercase">
            Credit history
          </h2>
          {ledger.data?.length ? (
            <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-card">
              {ledger.data.map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-4 p-3">
                  <div className="min-w-0">
                    <p>{ledgerText[l.kind] ?? l.kind}</p>
                    <p className="truncate text-sm text-muted">
                      {formatDate(l.created_at)}
                      {l.note ? ` · ${l.note}` : ''}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 font-medium',
                      ledgerSign[l.kind] === '+' ? 'text-sage-deep' : 'text-ink',
                    )}
                  >
                    {ledgerSign[l.kind] ?? ''}
                    {l.amount}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-muted">No credit changes yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
