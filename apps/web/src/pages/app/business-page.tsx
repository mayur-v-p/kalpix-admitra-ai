import { useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/auth-context';
import { confirmBusinessPhone, confirmLocation } from '@/features/products/api';
import { ConfirmFact } from '@/features/products/confirm-fact';
import { saveBusiness } from '@/features/workspace/api';
import { BusinessForm } from '@/features/workspace/business-form';
import { businessDefaults } from '@/features/workspace/form-defaults';
import { useWorkspace, workspaceKey } from '@/features/workspace/hooks';
import { PageError, PageHeader, PageLoading } from './page-state';

export function BusinessPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useWorkspace();

  if (isLoading) return <PageLoading />;
  if (isError || !data) return <PageError onRetry={() => refetch()} />;
  const { business, location } = data;
  if (!business) return <Navigate to="/app/onboarding" replace />;

  const refresh = () => queryClient.invalidateQueries({ queryKey: workspaceKey(user?.id) });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Settings"
        title="Business profile"
        intro="Details shown on your ads. Changing the phone number or address means confirming it again."
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="rounded-2xl border border-line bg-card p-5 shadow-soft md:p-8">
          <BusinessForm
            defaultValues={businessDefaults(business, location)}
            submitLabel="Save changes"
            onSubmit={async (values) => {
              await saveBusiness(data, values);
              await refresh();
            }}
          />
        </div>

        <aside className="flex flex-col gap-6" aria-label="Confirmed details">
          <section>
            <h2 className="mb-2 font-sans text-base font-medium tracking-normal normal-case">
              Phone on ads
            </h2>
            {business.phone ? (
              <ConfirmFact
                label="phone number"
                value={business.phone}
                confirmedAt={business.phone_confirmed_at}
                onConfirm={async () => {
                  await confirmBusinessPhone(business.id);
                  await refresh();
                }}
              />
            ) : (
              <p className="text-muted">Add a phone or WhatsApp number to show it on ads.</p>
            )}
          </section>
          <section>
            <h2 className="mb-2 font-sans text-base font-medium tracking-normal normal-case">
              Address on ads
            </h2>
            {location ? (
              <ConfirmFact
                label="address"
                value={`${location.address}, ${location.city}`}
                confirmedAt={location.confirmed_at}
                onConfirm={async () => {
                  await confirmLocation(location.id);
                  await refresh();
                }}
              />
            ) : (
              <p className="text-muted">Add your shop address to show it on ads.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
