import { CheckCircle2, Circle } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { ButtonLink } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
import { useCredits } from '@/features/exports/hooks';
import { SpeakYourAd } from '@/features/voice/voice-panel';
import { useCampaigns } from '@/features/campaigns/hooks';
import { useProducts } from '@/features/products/hooks';
import { useWorkspace } from '@/features/workspace/hooks';
import { PageError, PageLoading } from './page-state';

export function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useWorkspace();
  const products = useProducts(data?.workspace.id);
  const campaigns = useCampaigns(data?.workspace.id);
  const credits = useCredits(data?.workspace.id);

  if (isLoading) return <PageLoading />;
  if (isError || !data) return <PageError onRetry={() => refetch()} />;
  // First visit: set up the business before anything else.
  if (!data.business) return <Navigate to="/app/onboarding" replace />;

  const firstName = (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0];
  const steps: Array<{ done: boolean; label: string; to?: string; soon?: string }> = [
    { done: true, label: 'Business details', to: '/app/business' },
    { done: Boolean(data.brandKit), label: 'Brand kit: logo, colours and tone', to: '/app/brand' },
    {
      done: Boolean(data.business.phone_confirmed_at),
      label: 'Confirm your phone number for ads',
      to: '/app/business',
    },
    {
      done: (products.data?.length ?? 0) > 0,
      label: 'Add your first product',
      to: '/app/products',
    },
    {
      done: Boolean(products.data?.some((p) => p.price_confirmed_at)),
      label: 'Confirm a product price',
      to: '/app/products',
    },
    {
      done: (campaigns.data?.length ?? 0) > 0,
      label: 'Create your first campaign',
      to: '/app/campaigns/new',
    },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      {/* Version 2 welcome: greeting on a slowly zooming photo, with the small voice button. */}
      <section
        aria-label="Welcome"
        className="relative mb-6 flex min-h-[240px] items-end rounded-[28px]"
      >
        <div aria-hidden="true" className="absolute inset-0 overflow-hidden rounded-[28px] bg-ink">
          <img src="/images/cafe-hero.jpg" alt="" className="kb h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(28_27_58/0.93)_0%,rgb(28_27_58/0.78)_55%,rgb(28_27_58/0.35)_100%)]" />
        </div>
        <div className="relative flex w-full flex-wrap items-end justify-between gap-5 px-6 py-7 text-paper sm:px-8">
          <div className="flex max-w-xl flex-col gap-3">
            <span className="w-fit rounded-full border border-paper/30 bg-paper/15 px-3.5 py-1 text-sm">
              {data.business.name}
              {credits.data ? ` · ${credits.data.available} credits` : ''}
            </span>
            <h1
              className="text-[clamp(36px,6vw,52px)] leading-[1.05] font-medium tracking-[-0.01em]"
              aria-label={firstName ? `Namaste, ${firstName}.` : 'Welcome'}
            >
              <span aria-hidden="true">
                <span className="word">{firstName ? 'Namaste,' : 'Welcome'}</span>{' '}
                {firstName && (
                  <span className="word text-lamp [animation-delay:140ms]">{firstName}.</span>
                )}
              </span>
            </h1>
            <p className="text-paper/90">Your business is set up. Speak or type your next ad.</p>
          </div>
          <SpeakYourAd tone="onPhoto" />
        </div>
      </section>

      <section
        aria-labelledby="setup"
        className="rounded-3xl border border-line bg-card p-6 shadow-soft"
      >
        <h2 id="setup" className="text-2xl font-medium tracking-normal">
          Getting started
        </h2>
        <ul className="mt-4 divide-y divide-line">
          {steps.map((s) => (
            <li key={s.label} className="flex min-h-14 items-center gap-3 py-2">
              {s.done ? (
                <CheckCircle2 className="h-6 w-6 shrink-0 text-indigo-deep" aria-label="Done" />
              ) : (
                <Circle className="h-6 w-6 shrink-0 text-concrete" aria-label="Not done" />
              )}
              {s.to && !s.soon ? (
                <Link
                  to={s.to}
                  className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
                >
                  {s.label}
                </Link>
              ) : (
                <span className={s.done ? '' : 'text-muted'}>{s.label}</span>
              )}
              {s.soon && (
                <span className="ml-auto rounded-full bg-paper-deep px-2 py-0.5 text-xs text-muted">
                  Soon
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {!data.brandKit && (
        <div className="mt-6 flex flex-col items-start gap-4 rounded-3xl bg-lamp-soft p-6 md:flex-row md:items-center md:justify-between">
          <p>Add your logo and colours so every ad looks like yours.</p>
          <ButtonLink to="/app/brand" variant="dark" className="w-full md:w-auto">
            Set up brand kit
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
