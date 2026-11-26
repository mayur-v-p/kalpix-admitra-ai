import { useQueryClient } from '@tanstack/react-query';
import { Scissors, ShoppingBag, Sparkles, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
import { saveBusiness } from '@/features/workspace/api';
import { BrandForm } from '@/features/workspace/brand-form';
import { BusinessForm } from '@/features/workspace/business-form';
import { businessDefaults } from '@/features/workspace/form-defaults';
import { useWorkspace, workspaceKey } from '@/features/workspace/hooks';
import { industryOptions, type IndustryValue } from '@/features/workspace/options';
import { cn } from '@/lib/utils';
import { PageError, PageLoading } from './page-state';

const industryIcons: Record<IndustryValue, LucideIcon> = {
  food: UtensilsCrossed,
  retail: ShoppingBag,
  beauty: Scissors,
  other: Sparkles,
};

const stepTitles = ['Your industry', 'Business details', 'Brand kit'];

/** First-run wizard: industry -> details -> brand. Each step saves before moving on. */
export function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useWorkspace();
  const [industry, setIndustry] = useState<IndustryValue | null>(null);
  const [step, setStep] = useState<number | null>(null);

  if (isLoading) return <PageLoading />;
  if (isError || !data) return <PageError onRetry={() => refetch()} />;
  if (data.business && data.brandKit) return <Navigate to="/app" replace />;

  // Resume where the user left off.
  const current = step ?? (data.business ? 2 : 0);
  const refresh = () => queryClient.invalidateQueries({ queryKey: workspaceKey(user?.id) });

  return (
    <div className="mx-auto max-w-3xl">
      <ol className="mb-8 flex gap-2" aria-label="Setup progress">
        {stepTitles.map((title, i) => (
          <li key={title} className="flex-1" aria-current={i === current ? 'step' : undefined}>
            <span className={cn('block h-1.5 rounded-full', i <= current ? 'bg-ink' : 'bg-line')} />
            <span className={cn('mt-2 block text-sm', i === current ? 'text-ink' : 'text-muted')}>
              {i + 1}. {title}
            </span>
          </li>
        ))}
      </ol>

      {current === 0 && (
        <section>
          <h1 className="text-3xl uppercase md:text-4xl">What kind of business is it?</h1>
          <p className="mt-3 text-muted">
            This sets your templates, calls to action and festival calendar.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Industry">
            {industryOptions.map(({ value, label }) => {
              const Icon = industryIcons[value];
              const selected = industry === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setIndustry(value)}
                  className={cn(
                    'flex min-h-20 items-center gap-4 rounded-2xl border bg-card p-5 text-left text-lg transition-colors',
                    selected ? 'border-ink bg-lamp-soft' : 'border-line hover:border-ink/50',
                  )}
                >
                  <Icon className="h-7 w-7 shrink-0 text-sage-deep" aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>
          <div className="mt-8 flex justify-end">
            <Button
              variant="dark"
              size="lg"
              className="w-full sm:w-auto"
              disabled={!industry}
              onClick={() => setStep(1)}
            >
              Continue
            </Button>
          </div>
        </section>
      )}

      {current === 1 && (
        <section>
          <h1 className="text-3xl uppercase md:text-4xl">Tell us about your business</h1>
          <p className="mt-3 mb-8 text-muted">
            These details appear on your ads. You can change them any time.
          </p>
          <BusinessForm
            defaultValues={businessDefaults(data.business, data.location, industry ?? undefined)}
            showIndustry={false}
            submitLabel="Save and continue"
            onSubmit={async (values) => {
              await saveBusiness(data, { ...values, industry: industry ?? values.industry });
              await refresh();
              setStep(2);
            }}
            extraActions={
              <Button variant="ghost" size="lg" onClick={() => setStep(0)}>
                Back
              </Button>
            }
          />
        </section>
      )}

      {current === 2 && data.business && (
        <section>
          <h1 className="text-3xl uppercase md:text-4xl">Make it look like you</h1>
          <p className="mt-3 mb-8 text-muted">Your logo, colours and tone are used on every ad.</p>
          <BrandForm
            bundle={data}
            businessId={data.business.id}
            submitLabel="Finish setup"
            onSaved={async () => {
              await refresh();
              navigate('/app', { replace: true });
            }}
            extraActions={
              <Button variant="ghost" size="lg" onClick={() => navigate('/app')}>
                Skip for now
              </Button>
            }
          />
        </section>
      )}
    </div>
  );
}
