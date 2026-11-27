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

  // v3: pastel cards, the highlighted plan in navy.
  const pastels = ['bg-card border border-line', 'bg-pink', 'bg-lilac', 'bg-mint'];
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {plans.map((plan, i) => (
        <article
          key={plan.id}
          className={cn(
            'kx-lift relative flex flex-col rounded-[28px] p-7',
            plan.highlighted
              ? 'kx-night text-white shadow-[0_26px_50px_rgb(11_16_51/0.3)]'
              : pastels[i % pastels.length],
          )}
        >
          {plan.highlighted && (
            <p className="absolute -top-3.5 left-7 rounded-full bg-blue px-3.5 py-1 text-xs font-bold text-white">
              Most popular
            </p>
          )}
          <h3 className="font-display text-[22px] font-semibold tracking-normal">{plan.name}</h3>
          <p className={cn('mt-1 text-sm', plan.highlighted ? 'text-[#b8bde6]' : 'text-muted')}>
            {plan.audience}
          </p>
          <p className="mt-5 flex items-baseline gap-1">
            <span className="font-display text-[52px] leading-none font-light tracking-[-0.03em]">
              {formatInr(plan.price)}
            </span>
            <span className={plan.highlighted ? 'text-[#b8bde6]' : 'text-muted'}>
              {plan.period === 'month' ? '/ month' : 'forever'}
            </span>
          </p>
          <ul className="mt-5 flex flex-1 flex-col gap-2.5">
            {plan.features.map((f) => (
              <li key={f} className="flex gap-2.5 text-[15px]">
                <Check
                  className={cn(
                    'mt-1 h-4 w-4 shrink-0',
                    plan.highlighted ? 'text-[#8fb0ff]' : 'text-indigo',
                  )}
                  aria-hidden="true"
                />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <ButtonLink
            to={ctaTo(plan)}
            variant={plan.highlighted ? 'primary' : 'dark'}
            className="mt-6 w-full"
          >
            {plan.price === 0 ? 'Start free' : `Choose ${plan.name}`}
          </ButtonLink>
        </article>
      ))}
    </div>
  );
}
