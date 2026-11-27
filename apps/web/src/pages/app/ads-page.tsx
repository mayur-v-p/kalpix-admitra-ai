import { Package, Store } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { FormMessage } from '@/components/ui/form-field';
import { useCampaigns } from '@/features/campaigns/hooks';
import { AdCard } from '@/features/design/ad-card';
import { adStatuses, useWorkspaceJobs, type AdStatus } from '@/features/design/ads-api';
import { useBusinessPhotos } from '@/features/design/business-photos';
import { nextFestival, useQuickAd } from '@/features/design/use-quick-ad';
import { useProducts } from '@/features/products/hooks';
import { SpeakYourAd } from '@/features/voice/voice-panel';
import { useWorkspace } from '@/features/workspace/hooks';
import { PageError, PageLoading } from './page-state';

const TABS: Array<{ key: 'all' | AdStatus; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'ready', label: 'Ready' },
  { key: 'making', label: 'Making video' },
  { key: 'draft', label: 'Drafts' },
];

/** "My Ads": every ad the owner made, playing, with ways to make a new one. */
export function AdsPage() {
  const { data, isLoading, isError, refetch } = useWorkspace();
  const ws = data?.workspace.id;
  const campaigns = useCampaigns(ws);
  const products = useProducts(ws);
  const jobs = useWorkspaceJobs(ws);
  const photos = useBusinessPhotos(data?.business?.id);
  const quick = useQuickAd(data?.business);
  const [tab, setTab] = useState<'all' | AdStatus>('all');

  if (isLoading || campaigns.isLoading) return <PageLoading />;
  if (isError || !data) return <PageError onRetry={() => refetch()} />;
  if (!data.business) return <Navigate to="/app/onboarding" replace />;
  const business = data.business;

  const { latest, ready, status } = adStatuses(jobs.data);
  const mainPhoto = photos.data?.find((p) => p.is_main)?.url ?? photos.data?.[0]?.url ?? null;
  const productById = new Map((products.data ?? []).map((p) => [p.id, p]));
  const all = campaigns.data ?? [];
  const count = (k: 'all' | AdStatus) =>
    k === 'all' ? all.length : all.filter((c) => status(c.id) === k).length;
  const shown = tab === 'all' ? all : all.filter((c) => status(c.id) === tab);
  const festival = nextFestival();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-7">
      <header className="kx-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kx-eyebrow text-indigo">My ads</p>
          <h1 className="mt-1.5 text-[clamp(34px,4.2vw,48px)] leading-[1.06] font-medium tracking-[-0.015em]">
            Your <span className="kx-grad">ads</span>
          </h1>
          <p className="mt-2 text-muted">
            Every ad you made. Open one to change it, or download and share.
          </p>
        </div>
        <div className="flex gap-2.5">
          <span className="rounded-2xl border border-ink/10 bg-white/85 px-4 py-2.5 text-sm">
            <strong className="font-display text-2xl font-medium">{all.length}</strong> ads
          </span>
          <span className="rounded-2xl border border-ink/10 bg-white/85 px-4 py-2.5 text-sm">
            <strong className="font-display text-2xl font-medium text-[#1f6b5f]">
              {ready.size}
            </strong>{' '}
            ready to share
          </span>
        </div>
      </header>

      <section
        aria-labelledby="new-title"
        className="kx-rise flex flex-col gap-3.5 [animation-delay:80ms]"
      >
        <h2 id="new-title" className="text-2xl font-medium tracking-normal normal-case">
          Make a new ad
        </h2>
        {quick.error && <FormMessage tone="error">{quick.error}</FormMessage>}
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          <div className="kx-lift relative flex min-h-[150px] flex-col justify-between gap-3 overflow-hidden rounded-3xl bg-gradient-to-br from-[#14132e] to-[#3b3a8f] p-5 text-white shadow-[0_16px_32px_rgb(35_34_89/0.3)]">
            <div
              className="kx-orb -top-10 -right-10 h-36 w-36 bg-[#e8b04b] opacity-40"
              aria-hidden="true"
            />
            <span className="relative">
              <span className="block font-display text-2xl">Speak your ad</span>
              <span className="block text-sm text-[#d8d6f5]">Fastest: just say it</span>
            </span>
            <SpeakYourAd tone="onPhoto" className="relative" />
          </div>
          <button
            type="button"
            onClick={() => quick.start('promote')}
            disabled={quick.busy !== null}
            className="kx-card kx-lift relative flex min-h-[150px] flex-col justify-end overflow-hidden rounded-3xl p-5 text-left disabled:opacity-60"
          >
            {mainPhoto && (
              <img
                src={mainPhoto}
                alt=""
                className="kb absolute inset-0 h-full w-full object-cover"
                aria-hidden="true"
              />
            )}
            <span
              className="absolute inset-0 bg-[linear-gradient(180deg,rgb(255_255_255/0.1)_20%,rgb(255_255_255/0.96)_82%)]"
              aria-hidden="true"
            />
            <Store className="relative mb-auto h-6 w-6 text-indigo" aria-hidden="true" />
            <span className="relative font-display text-2xl">
              {quick.busy === 'promote' ? 'Starting…' : 'Promote my business'}
            </span>
            <span className="relative text-sm text-muted">Uses your business photos</span>
          </button>
          <Link
            to="/app/products"
            className="kx-card kx-lift relative flex min-h-[150px] flex-col justify-end overflow-hidden rounded-3xl p-5"
          >
            <span
              className="kx-float absolute top-4 right-4 flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-white bg-[#fdf0d6] shadow-lg"
              aria-hidden="true"
            >
              <Package className="h-7 w-7 text-[#a86a12]" />
            </span>
            <span className="font-display text-2xl">From a product</span>
            <span className="text-sm text-muted">Pick a product from your list</span>
          </Link>
          <button
            type="button"
            onClick={() => quick.start('festival')}
            disabled={quick.busy !== null}
            className="kx-lift relative flex min-h-[150px] flex-col justify-end overflow-hidden rounded-3xl bg-gradient-to-br from-[#3a0a1c] to-[#7a1838] p-5 text-left text-[#fff4d6] shadow-[0_16px_32px_rgb(58_10_28/0.28)] disabled:opacity-60"
          >
            <span
              className="kx-star kx-twinkle absolute top-5 left-6 h-4 w-4 bg-[#e8b04b]"
              aria-hidden="true"
            />
            <span
              className="kx-star kx-twinkle absolute top-10 right-9 h-3 w-3 bg-[#fbe7bf] [animation-delay:1s]"
              aria-hidden="true"
            />
            <span className="font-display text-2xl">
              {quick.busy === 'festival' ? 'Starting…' : 'Festival greeting'}
            </span>
            <span className="text-sm text-[#f3d9c6]">
              {festival.days === 0
                ? `${festival.name} is today`
                : `${festival.name} in ${festival.days} days`}
            </span>
          </button>
        </div>
      </section>

      <div role="tablist" aria-label="Filter ads" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className="kx-chip min-h-11 rounded-full px-4 font-semibold"
          >
            {t.label} · {count(t.key)}
          </button>
        ))}
      </div>

      {shown.length ? (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="Ads">
          {shown.map((c, i) => {
            const s = status(c.id);
            return (
              <li
                key={c.id}
                className="kx-rise"
                style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
              >
                <AdCard
                  campaign={c}
                  business={business}
                  product={c.product_id ? productById.get(c.product_id) : null}
                  businessPhoto={mainPhoto}
                  index={i}
                  status={s}
                  progress={latest.get(c.id)?.progress ?? 0}
                  readyJobId={ready.get(c.id)?.id}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="kx-card rounded-3xl p-8 text-center">
          <p className="text-lg">
            {all.length ? 'No ads here yet.' : 'You have not made an ad yet.'}
          </p>
          <p className="mt-1 text-muted">
            Speak one, or start from a product or your business above.
          </p>
        </div>
      )}
    </div>
  );
}
