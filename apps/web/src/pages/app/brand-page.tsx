import { useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/auth-context';
import { BrandForm } from '@/features/workspace/brand-form';
import { useWorkspace, workspaceKey } from '@/features/workspace/hooks';
import { PageError, PageHeader, PageLoading } from './page-state';

export function BrandPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useWorkspace();

  if (isLoading) return <PageLoading />;
  if (isError || !data) return <PageError onRetry={() => refetch()} />;
  if (!data.business) return <Navigate to="/app/onboarding" replace />;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Settings"
        title="Brand kit"
        intro="Logo, colours, fonts and tone used on every ad."
      />
      <BrandForm
        bundle={data}
        businessId={data.business.id}
        submitLabel="Save brand kit"
        onSaved={() => queryClient.invalidateQueries({ queryKey: workspaceKey(user?.id) })}
      />
    </div>
  );
}
