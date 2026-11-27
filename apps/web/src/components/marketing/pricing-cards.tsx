import { Check } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { plans as fallbackPlans, type Plan } from '@/data/plans';
import { useAuth } from '@/features/auth/auth-context';
import { usePlans } from '@/features/billing/hooks';
import { cn, formatInr } from '@/lib/utils';

/**
 * Plan cards, from the `plans` table (the static copy shows only while it loads).
 * Signed-out visitors go to sign-up; signed-in owners go to Billing, where Razorpay Checkout
 * opens from a server-created subscription (payment-gateway.md).
 */
export function PricingCards() {
  const { user } = useAuth();
  const { data } = usePlans();
  const plans: Plan[] = data?.length
    ? data.map((p) => ({
        id: p.id as Plan['id'],
        name: p.name,
        price: p.price_inr,
        period: p.price_inr > 0 ? 'month' : 'forever',
        audience: p.audience,
        features: p.features,
        highlighted: p.highlighted,
      }))
    : fallbackPlans;
  const ctaTo = (plan: Plan) =>
    user ? (plan.price === 0 ? '/app' : `/app/billing?plan=${plan.id}`) : `/signup?plan=${plan.id}`;

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {plans.map((plan) => (
        <article
          key={plan.id}
          className={cn(
            'relative flex flex-col rounded-2xl border bg-card p-6 shadow-soft',
            plan.highlighted ? 'border-ink ring-1 ring-ink' : 'border-line',
          )}
        >
          {plan.highlighted && (
            <p className="absolute -top-3 left-6 rounded-full bg-lamp px-3 py-0.5 text-sm font-medium">
              Most popular
            </p>
          )}
          <h3 className="font-display text-xl tracking-[0.15em]">{plan.name}</h3>
          <p className="mt-1 text-sm text-muted">{plan.audience}</p>
          <p className="mt-5 flex items-baseline gap-1">
            <span className="font-display text-4xl font-light">{formatInr(plan.price)}</span>
            <span className="text-muted">{plan.period === 'month' ? '/ month' : 'forever'}</span>
          </p>
          <ul className="mt-5 flex flex-1 flex-col gap-2.5">
            {plan.features.map((f) => (
              <li key={f} className="flex gap-2.5 text-base">
                <Check className="mt-1 h-4 w-4 shrink-0 text-indigo-deep" aria-hidden="true" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <ButtonLink
            to={ctaTo(plan)}
            variant={plan.highlighted ? 'primary' : 'outline'}
            className="mt-6 w-full"
          >
            {plan.price === 0 ? 'Start free' : `Choose ${plan.name}`}
          </ButtonLink>
        </article>
      ))}
    </div>
  );
}
