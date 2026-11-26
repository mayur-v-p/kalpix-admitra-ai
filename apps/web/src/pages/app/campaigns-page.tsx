import { BadgeCheck, Plus, ShieldAlert } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { ButtonLink } from '@/components/ui/button';
import { useCampaigns } from '@/features/campaigns/hooks';
import { goalOptions } from '@/features/campaigns/options';
import { useWorkspace } from '@/features/workspace/hooks';
import { PageError, PageHeader, PageLoading } from './page-state';

export function CampaignsPage() {
  const workspace = useWorkspace();
  const campaigns = useCampaigns(workspace.data?.workspace.id);

  if (workspace.isLoading || campaigns.isLoading) return <PageLoading />;
  if (workspace.isError || !workspace.data)
    return <PageError onRetry={() => workspace.refetch()} />;
  if (!workspace.data.business) return <Navigate to="/app/onboarding" replace />;
  if (campaigns.isError) return <PageError onRetry={() => campaigns.refetch()} />;
  const list = campaigns.data ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <PageHeader
          eyebrow="Ads"
          title="Campaigns"
          intro="One campaign = one offer. Preview it in every style and size, then export."
        />
        <ButtonLink to="/app/campaigns/new" variant="dark" className="mb-8 w-full md:w-auto">
          <Plus className="h-5 w-5" aria-hidden="true" /> New campaign
        </ButtonLink>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-card p-10 text-center">
          <p className="text-lg">No campaigns yet.</p>
          <p className="mt-2 text-muted">
            Pick a product, write your offer, and watch your Outline Highlight ad play.
          </p>
          <ButtonLink to="/app/campaigns/new" variant="primary" className="mt-6">
            Create your first campaign
          </ButtonLink>
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-card shadow-soft">
          {list.map((c) => (
            <li key={c.id}>
              <Link
                to={`/app/campaigns/${c.id}/studio`}
                className="flex min-h-16 flex-col gap-1 p-4 hover:bg-paper sm:flex-row sm:items-center sm:justify-between"
              >
                <span>
                  <span className="block text-lg font-medium">{c.name}</span>
                  <span className="text-sm text-muted">
                    {goalOptions.find((g) => g.value === c.goal)?.label}
                    {c.offer_text ? ` · ${c.offer_text}` : ''}
                  </span>
                </span>
                <span className="text-sm">
                  {!c.offer_text ? (
                    <span className="text-muted">No offer</span>
                  ) : c.facts_confirmed_at ? (
                    <span className="inline-flex items-center gap-1.5 text-indigo-deep">
                      <BadgeCheck className="h-4 w-4" aria-hidden="true" /> Offer confirmed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-lamp-deep">
                      <ShieldAlert className="h-4 w-4" aria-hidden="true" /> Offer needs confirming
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
