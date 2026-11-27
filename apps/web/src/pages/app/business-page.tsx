import { useQueryClient } from '@tanstack/react-query';
import { Store } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/auth-context';
import { BusinessDetailsCard } from '@/features/design/business-details';
import { BusinessPhotosCard } from '@/features/design/business-photos-card';
import { useBusinessPhotos } from '@/features/design/business-photos';
import { SECTOR_LABELS } from '@/features/design/labels';
import { MiniAd } from '@/features/design/mini-ad';
import { useQuickAd } from '@/features/design/use-quick-ad';
import { confirmBusinessPhone, confirmLocation } from '@/features/products/api';
import { ConfirmFact } from '@/features/products/confirm-fact';
import { saveBusiness } from '@/features/workspace/api';
import { BrandForm } from '@/features/workspace/brand-form';
import { BusinessForm } from '@/features/workspace/business-form';
import { businessDefaults } from '@/features/workspace/form-defaults';
import { useSignedUrl, useWorkspace, workspaceKey } from '@/features/workspace/hooks';
import { sectorOf } from '@admitra/styles-engine';
import { PageError, PageLoading } from './page-state';

export function BusinessPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useWorkspace();
  const photos = useBusinessPhotos(data?.business?.id);
  const logo = useSignedUrl(data?.brandKit?.logo_path);
  const quick = useQuickAd(data?.business);

  if (isLoading) return <PageLoading />;
  if (isError || !data) return <PageError onRetry={() => refetch()} />;
  const { business, location, brandKit } = data;
  if (!business) return <Navigate to="/app/onboarding" replace />;

  const refresh = () => queryClient.invalidateQueries({ queryKey: workspaceKey(user?.id) });
  const mainPhoto = photos.data?.find((p) => p.is_main)?.url ?? photos.data?.[0]?.url ?? null;
  const accent = brandKit?.accent_color ?? '#f2a541';
  const sub = [SECTOR_LABELS[sectorOf(business.industry)], location?.city, business.opening_hours]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-7">
      {/* Cover: the main photo behind the name. */}
      <section
        aria-label="Business"
        className="kx-rise relative isolate flex min-h-[220px] items-end overflow-hidden rounded-[30px] px-6 py-7 text-white shadow-[0_24px_50px_rgb(20_19_46/0.22)] sm:px-9"
      >
        <div className="absolute inset-0 -z-10 bg-[#14132e]" aria-hidden="true">
          {mainPhoto && <img src={mainPhoto} alt="" className="kb h-full w-full object-cover" />}
          <div className="absolute inset-0 bg-[linear-gradient(100deg,rgb(20_19_46/0.92)_0%,rgb(35_34_89/0.7)_50%,rgb(35_34_89/0.15)_100%)]" />
        </div>
        <div className="flex w-full flex-wrap items-end justify-between gap-5">
          <div className="flex items-center gap-4">
            <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[22px] border-[3px] border-white/85 bg-gradient-to-br from-[#3b3a8f] to-[#14132e] shadow-xl">
              {logo.data ? (
                <img src={logo.data} alt="" className="h-full w-full object-cover" />
              ) : (
                <Store className="h-9 w-9 text-[#fbe7bf]" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0">
              <p className="kx-eyebrow text-[#fbe7bf]">Business</p>
              <h1 className="mt-1 text-[clamp(32px,4vw,46px)] leading-[1.05] font-medium tracking-[-0.015em] text-white">
                {business.name}
              </h1>
              {sub && <p className="mt-1 text-[#d8d6f5]">{sub}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => quick.start('promote')}
            disabled={quick.busy !== null}
            className="kx-btn-gold kx-sweep inline-flex min-h-12 items-center rounded-full px-6 font-bold disabled:opacity-60"
          >
            {quick.busy ? 'Starting…' : 'Make a "Promote my business" ad'}
          </button>
        </div>
      </section>
      {quick.error && (
        <p role="alert" className="text-red-800">
          {quick.error}
        </p>
      )}

      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="flex min-w-0 flex-col gap-7">
          <section
            aria-labelledby="details-title"
            className="kx-card kx-rise rounded-[26px] p-6 md:p-8"
          >
            <p className="kx-eyebrow text-indigo">About you</p>
            <h2
              id="details-title"
              className="mt-1.5 mb-5 text-2xl font-medium tracking-normal normal-case"
            >
              Business details
            </h2>
            <BusinessForm
              defaultValues={businessDefaults(business, location)}
              submitLabel="Save changes"
              onSubmit={async (values) => {
                await saveBusiness(data, values);
                await refresh();
              }}
            />
          </section>

          <BusinessPhotosCard business={business} />

          <BusinessDetailsCard key={business.id} business={business} onSaved={refresh} />

          <section
            id="brand"
            aria-labelledby="brand-title"
            className="kx-card kx-rise scroll-mt-24 rounded-[26px] p-6 md:p-8"
          >
            <p className="kx-eyebrow text-indigo">Optional</p>
            <h2
              id="brand-title"
              className="mt-1.5 text-2xl font-medium tracking-normal normal-case"
            >
              Logo and colours
            </h2>
            <p className="mt-1 mb-5 text-muted">
              The AI uses your colours and logo when it designs.
            </p>
            <BrandForm
              bundle={data}
              businessId={business.id}
              submitLabel="Save logo and colours"
              onSaved={refresh}
            />
          </section>
        </div>

        <aside className="flex flex-col gap-6" aria-label="Confirmed details and preview">
          <section className="kx-night relative overflow-hidden rounded-[30px] p-6 text-white shadow-[0_24px_50px_rgb(20_19_46/0.28)] lg:sticky lg:top-6">
            <div
              className="kx-orb -top-16 -right-16 h-52 w-52 bg-[#e8b04b] opacity-35"
              aria-hidden="true"
            />
            <p className="kx-eyebrow relative text-[#fbe7bf]">Live preview</p>
            <p className="relative mt-1.5 font-display text-xl">How your business looks in ads</p>
            <div className="kx-float relative mx-auto mt-5 w-fit overflow-hidden rounded-[22px] shadow-[0_26px_48px_rgb(0_0_0/0.45)]">
              <MiniAd
                ad={{
                  photo: mainPhoto,
                  line1: business.name,
                  line2: business.specialities?.[0] ?? 'Aaiye, milte hain',
                  cta: 'Visit us today',
                  business: business.name,
                  bg: brandKit?.primary_color ?? '#2a1a10',
                  ink: '#fff8ee',
                  accent,
                }}
              />
            </div>
          </section>

          <section className="kx-card rounded-[26px] p-5">
            <h2 className="mb-2 font-sans text-base font-semibold tracking-normal normal-case">
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
          <section className="kx-card rounded-[26px] p-5">
            <h2 className="mb-2 font-sans text-base font-semibold tracking-normal normal-case">
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
