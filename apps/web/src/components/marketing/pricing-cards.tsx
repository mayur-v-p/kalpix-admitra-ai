import { Check } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { plans } from '@/data/plans';
import { cn, formatInr } from '@/lib/utils';

/**
 * Plan cards. In M1 every CTA leads to sign-up. In M7 paid plans open Razorpay
 * Checkout from a server-created subscription (payment-gateway.md).
 */
export function PricingCards() {
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
          <h3 className="font-display text-xl tracking-[0.15em] uppercase">{plan.name}</h3>
          <p className="mt-1 text-sm text-muted">{plan.audience}</p>
          <p className="mt-5 flex items-baseline gap-1">
            <span className="font-display text-4xl font-light">{formatInr(plan.price)}</span>
            <span className="text-muted">{plan.period === 'month' ? '/ month' : 'forever'}</span>
          </p>
          <ul className="mt-5 flex flex-1 flex-col gap-2.5">
            {plan.features.map((f) => (
              <li key={f} className="flex gap-2.5 text-base">
                <Check className="mt-1 h-4 w-4 shrink-0 text-sage-deep" aria-hidden="true" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <ButtonLink
            to={`/signup?plan=${plan.id}`}
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
