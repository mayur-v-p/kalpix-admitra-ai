import { CheckCircle2, Circle } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { ButtonLink } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
import { useCampaigns } from '@/features/campaigns/hooks';
import { useProducts } from '@/features/products/hooks';
import { useWorkspace } from '@/features/workspace/hooks';
import { PageError, PageHeader, PageLoading } from './page-state';

export function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useWorkspace();
  const products = useProducts(data?.workspace.id);
  const campaigns = useCampaigns(data?.workspace.id);

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
      <PageHeader
        eyebrow={data.business.name}
        title={firstName ? `Namaste, ${firstName}` : 'Welcome'}
        intro="Your business is set up. Create a campaign to see your first ad."
      />

      <section
        aria-labelledby="setup"
        className="rounded-2xl border border-line bg-card p-6 shadow-soft"
      >
        <h2 id="setup" className="text-xl uppercase md:text-2xl">
          Getting started
        </h2>
        <ul className="mt-4 divide-y divide-line">
          {steps.map((s) => (
            <li key={s.label} className="flex min-h-14 items-center gap-3 py-2">
              {s.done ? (
                <CheckCircle2 className="h-6 w-6 shrink-0 text-sage-deep" aria-label="Done" />
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
        <div className="mt-6 flex flex-col items-start gap-4 rounded-2xl bg-lamp-soft p-6 md:flex-row md:items-center md:justify-between">
          <p>Add your logo and colours so every ad looks like yours.</p>
          <ButtonLink to="/app/brand" variant="dark" className="w-full md:w-auto">
            Set up brand kit
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
