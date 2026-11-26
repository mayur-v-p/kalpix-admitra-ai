import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { createCampaign } from '@/features/campaigns/api';
import { BriefForm } from '@/features/campaigns/brief-form';
import { campaignsKey } from '@/features/campaigns/hooks';
import { useProducts } from '@/features/products/hooks';
import { useWorkspace } from '@/features/workspace/hooks';
import { PageError, PageHeader, PageLoading } from './page-state';

export function CampaignNewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workspace = useWorkspace();
  const products = useProducts(workspace.data?.workspace.id);

  if (workspace.isLoading || products.isLoading) return <PageLoading />;
  if (workspace.isError || !workspace.data)
    return <PageError onRetry={() => workspace.refetch()} />;
  const { business, workspace: ws } = workspace.data;
  if (!business) return <Navigate to="/app/onboarding" replace />;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to="/app/campaigns"
        className="mb-4 inline-flex min-h-11 items-center gap-2 text-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All campaigns
      </Link>
      <PageHeader
        eyebrow="New campaign"
        title="What are you promoting?"
        intro="Fill in the offer. Next, you will see it as an Outline Highlight ad and can confirm the details."
      />
      {(products.data?.length ?? 0) === 0 && (
        <p className="mb-6 rounded-xl bg-lamp-soft p-4">
          Tip:{' '}
          <Link to="/app/products/new" className="underline">
            add a product
          </Link>{' '}
          first, so the ad can show its photo.
        </p>
      )}
      <div className="rounded-2xl border border-line bg-card p-5 shadow-soft md:p-8">
        <BriefForm
          products={products.data ?? []}
          defaultLanguage={business.languages?.[0] ?? 'en'}
          submitLabel="Create and preview"
          onSubmit={async (values) => {
            const created = await createCampaign(
              { workspaceId: ws.id, businessId: business.id },
              values,
            );
            await queryClient.invalidateQueries({ queryKey: campaignsKey(ws.id) });
            navigate(`/app/campaigns/${created.id}/studio`, { replace: true });
          }}
        />
      </div>
    </div>
  );
}
