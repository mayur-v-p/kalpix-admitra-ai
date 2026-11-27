import { ArrowRight, Package, Sparkles, Store } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { FormMessage } from '@/components/ui/form-field';
import { useAuth } from '@/features/auth/auth-context';
import { useCampaigns } from '@/features/campaigns/hooks';
import { CampaignMini } from '@/features/design/ad-card';
import { adStatuses, useWorkspaceJobs } from '@/features/design/ads-api';
import { useBusinessPhotos } from '@/features/design/business-photos';
import { MiniAd, type MiniAdData } from '@/features/design/mini-ad';
import { nextFestival, useQuickAd } from '@/features/design/use-quick-ad';
import { useCredits } from '@/features/exports/hooks';
import { useProducts } from '@/features/products/hooks';
import { SpeakYourAd } from '@/features/voice/voice-panel';
import { useWorkspace } from '@/features/workspace/hooks';
import { cn } from '@/lib/utils';
import { PageError, PageLoading } from './page-state';

/** 0 → 1 over `ms` after mount, for counting numbers up. */
function useProgress(ms = 1400) {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      setT(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ms]);
  return 1 - (1 - t) ** 3;
}

const SPARKS = [
  'M4 36 C30 34 40 26 64 28 S100 14 124 18 S170 6 196 8',
  'M4 38 C28 36 44 30 70 32 S110 20 136 22 S176 12 196 10',
  'M4 34 C40 34 50 24 80 24 S130 22 150 14 S186 12 196 12',
  'M4 30 C30 28 50 22 80 24 S130 30 150 22 S186 18 196 16',
];

export function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useWorkspace();
  const ws = data?.workspace.id;
  const products = useProducts(ws);
  const campaigns = useCampaigns(ws);
  const credits = useCredits(ws);
  const jobs = useWorkspaceJobs(ws);
  const photos = useBusinessPhotos(data?.business?.id);
  const quick = useQuickAd(data?.business);
  const e = useProgress();

  if (isLoading) return <PageLoading />;
  if (isError || !data) return <PageError onRetry={() => refetch()} />;
  if (!data.business) return <Navigate to="/app/onboarding" replace />;
  const business = data.business;

  const firstName = (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0];
  const mainPhoto = photos.data?.find((p) => p.is_main)?.url ?? photos.data?.[0]?.url ?? null;
  const festival = nextFestival();
  const { ready, status } = adStatuses(jobs.data);
  const list = campaigns.data ?? [];
  const recent = list.slice(0, 3);
  const productById = new Map((products.data ?? []).map((p) => [p.id, p]));

  const steps = [
    {
      done: Boolean(data.business.phone_confirmed_at),
      label: 'Confirm your phone number',
      to: '/app/business',
    },
    {
      done: (photos.data?.length ?? 0) > 0,
      label: 'Add photos of your business',
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
    { done: Boolean(data.brandKit), label: 'Add your logo and colours', to: '/app/business#brand' },
    { done: list.length > 0, label: 'Make your first ad', to: '/app/products' },
  ];
  const done = steps.filter((s) => s.done).length;

  const stats = [
    {
      label: 'Ads made',
      value: list.length,
      note: 'All your ads',
      color: '#3b3a8f',
      tint: '#ecebfb',
    },
    {
      label: 'Videos ready',
      value: ready.size,
      note: 'WhatsApp, Reels, posters',
      color: '#d9952a',
      tint: '#fdf0d6',
    },
    {
      label: 'Products',
      value: products.data?.length ?? 0,
      note: 'In your list',
      color: '#2f8a7d',
      tint: '#e3f3ef',
    },
    {
      label: 'Credits left',
      value: credits.data?.available ?? 0,
      note: '1 credit = 1 size',
      color: '#c2410c',
      tint: '#fde5dc',
    },
  ];

  // Phones in the banner: the latest ads, or a first look built from the business.
  const sample: MiniAdData[] = [
    {
      photo: mainPhoto,
      line1: business.name,
      line2: 'Aaiye, milte hain',
      cta: 'Visit us today',
      business: business.name,
      bg: '#0f2a2e',
      ink: '#fffaf0',
      accent: '#fcd34d',
    },
    {
      photo: mainPhoto,
      line1: 'Your ad',
      line2: 'starts here',
      cta: 'Speak your ad',
      business: business.name,
      bg: '#2a1a10',
      ink: '#fff8ee',
      accent: '#f2a541',
    },
    {
      photo: mainPhoto,
      line1: `${festival.name}`,
      line2: 'greetings',
      cta: business.name,
      business: business.name,
      bg: '#3a0a1c',
      ink: '#fff4d6',
      accent: '#e8b04b',
    },
  ];
  const phone = (i: number, width: number) => {
    const c = recent[i];
    return c ? (
      <CampaignMini
        campaign={c}
        business={business}
        product={c.product_id ? productById.get(c.product_id) : null}
        businessPhoto={mainPhoto}
        index={i}
        width={width}
      />
    ) : (
      <MiniAd ad={sample[i]!} width={width} />
    );
  };

  const ideas = [
    `${festival.name} greeting`,
    ...(business.specialities ?? []).map((s) => `${s} spotlight`),
    'Weekend family special',
    'Thank your regular customers',
    'Show your place inside',
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-7">
      {/* Banner: greeting, voice, and three phones playing your ads. */}
      <section
        aria-label="Welcome"
        className="kx-night kx-rise relative isolate flex flex-wrap items-center gap-4 overflow-hidden rounded-[32px] px-6 py-9 text-white shadow-[0_30px_60px_rgb(20_19_46/0.28)] sm:px-10 lg:px-12"
      >
        <div
          className="kx-orb -top-28 -left-20 h-80 w-80 bg-[#5b57d6] opacity-45"
          aria-hidden="true"
        />
        <div
          className="kx-orb right-[6%] -bottom-36 h-72 w-72 bg-[#e8b04b] opacity-35 [animation-delay:-6s]"
          aria-hidden="true"
        />
        <div className="relative flex min-w-0 flex-[1_1_360px] flex-col gap-4">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-sm">
            <span className="kx-twinkle h-2 w-2 rounded-full bg-[#e8b04b]" aria-hidden="true" />
            {business.name}
          </span>
          <h1
            className="text-[clamp(40px,5.4vw,64px)] leading-[1.02] font-medium tracking-[-0.02em]"
            aria-label={firstName ? `Namaste, ${firstName}.` : 'Namaste.'}
          >
            <span aria-hidden="true">
              <span className="word">Namaste{firstName ? ',' : '.'}</span>{' '}
              {firstName && (
                <span className="word kx-gold-text [animation-delay:140ms]">{firstName}.</span>
              )}
            </span>
          </h1>
          <p className="max-w-md text-lg text-[#d8d6f5]">
            Say what you want, or pick an idea below. Kalpix designs the ad.
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <SpeakYourAd tone="onPhoto" />
            <Link
              to="/app/products"
              className="inline-flex min-h-12 items-center rounded-full border border-white/30 bg-white/5 px-6 font-semibold text-white hover:bg-white/10"
            >
              Pick a product
            </Link>
          </div>
        </div>
        <div
          className="relative mx-auto hidden h-[330px] min-w-[320px] flex-[1_1_360px] sm:block"
          aria-hidden="true"
        >
          <div className="absolute bottom-0 left-1/2 h-14 w-72 -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgb(232_176_75/0.45),transparent)] blur-md" />
          <div className="kx-float absolute top-9 left-[calc(50%-190px)] rounded-[24px] bg-[#0b0a1c] p-1.5 shadow-[0_24px_44px_rgb(0_0_0/0.45)] [--r:-9deg] [animation-delay:-2s]">
            <div className="overflow-hidden rounded-[18px]">{phone(1, 138)}</div>
          </div>
          <div className="kx-float absolute top-9 left-[calc(50%+40px)] rounded-[24px] bg-[#0b0a1c] p-1.5 shadow-[0_24px_44px_rgb(0_0_0/0.45)] [--r:9deg] [animation-delay:-4s]">
            <div className="overflow-hidden rounded-[18px]">{phone(2, 138)}</div>
          </div>
          <div className="kx-float absolute top-0 left-[calc(50%-98px)] rounded-[30px] bg-[#0b0a1c] p-2 shadow-[0_34px_60px_rgb(0_0_0/0.55)]">
            <div className="overflow-hidden rounded-[22px]">{phone(0, 180)}</div>
          </div>
          <span className="kx-float absolute top-2 right-0 rounded-2xl bg-white/95 px-3.5 py-2 text-sm font-semibold text-ink shadow-xl [animation-delay:-2s]">
            {recent.length ? 'Your latest ads' : 'Your first ad is waiting'}
          </span>
          <span className="kx-float absolute bottom-6 left-0 rounded-2xl bg-[#e8b04b] px-3.5 py-2 text-sm font-bold text-ink shadow-xl [animation-delay:-4s]">
            {festival.days === 0
              ? `${festival.name} is today`
              : `${festival.name} in ${festival.days} days`}
          </span>
        </div>
      </section>

      {/* Numbers */}
      <section aria-label="Your numbers" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="kx-card kx-lift kx-rise flex flex-col gap-1 rounded-[26px] p-5"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-muted">{s.label}</p>
              <span
                className="flex h-8 w-8 items-center justify-center rounded-xl"
                style={{ background: s.tint }}
                aria-hidden="true"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              </span>
            </div>
            <p className="font-display text-[44px] leading-none font-medium text-ink">
              {Math.round(s.value * e)}
            </p>
            <svg
              className="h-10 w-full"
              viewBox="0 0 200 44"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d={SPARKS[i]}
                fill="none"
                stroke={s.color}
                strokeWidth="3"
                strokeLinecap="round"
                className="kx-spark"
              />
            </svg>
            <p className="text-sm text-muted">{s.note}</p>
          </div>
        ))}
      </section>

      {/* Create */}
      <section aria-labelledby="create-title" className="flex flex-col gap-4">
        <div>
          <p className="kx-eyebrow text-indigo">Start here</p>
          <h2 id="create-title" className="mt-1.5 text-3xl font-medium tracking-normal normal-case">
            Create something <span className="kx-grad">new</span>
          </h2>
        </div>
        {quick.error && <FormMessage tone="error">{quick.error}</FormMessage>}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="kx-lift kx-rise relative flex min-h-[220px] flex-col justify-end gap-2 overflow-hidden rounded-[26px] bg-gradient-to-br from-[#232259] to-[#3b3a8f] p-5 text-white shadow-[0_18px_36px_rgb(35_34_89/0.3)]">
            <div
              className="kx-orb -top-12 -right-10 h-40 w-40 bg-[#e8b04b] opacity-40"
              aria-hidden="true"
            />
            <span className="relative font-display text-2xl">Speak your ad</span>
            <span className="relative text-sm text-[#d8d6f5]">
              Hindi, Marathi or English. Kalpix fills in the rest.
            </span>
            <SpeakYourAd tone="onPhoto" className="relative mt-2" />
          </div>
          <button
            type="button"
            onClick={() => quick.start('promote')}
            disabled={quick.busy !== null}
            className="kx-card kx-lift kx-rise relative flex min-h-[220px] flex-col justify-end gap-2 overflow-hidden rounded-[26px] p-5 text-left [animation-delay:80ms] disabled:opacity-60"
          >
            <div
              className="absolute inset-x-0 top-0 h-[104px] overflow-hidden rounded-t-[26px]"
              aria-hidden="true"
            >
              {mainPhoto ? (
                <img src={mainPhoto} alt="" className="kb h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-[radial-gradient(90%_90%_at_20%_10%,#ecebfb,#fbe7bf)]" />
              )}
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,rgb(255_255_255/0.95))]" />
            </div>
            <Store className="relative h-6 w-6 text-indigo" aria-hidden="true" />
            <span className="relative font-display text-2xl">
              {quick.busy === 'promote' ? 'Starting…' : 'Promote my business'}
            </span>
            <span className="relative text-sm text-muted">
              An ad about your place, made from your business photos.
            </span>
          </button>
          <Link
            to="/app/products"
            className="kx-card kx-lift kx-rise relative flex min-h-[220px] flex-col justify-end gap-2 overflow-hidden rounded-[26px] p-5 [animation-delay:160ms]"
          >
            <span
              className="kx-float absolute top-5 right-5 flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-[#fdf0d6] shadow-[0_14px_28px_rgb(35_34_89/0.18)]"
              aria-hidden="true"
            >
              <Package className="h-9 w-9 text-[#a86a12]" />
            </span>
            <span className="font-display text-2xl">From a product</span>
            <span className="text-sm text-muted">Pick any product and make its ad.</span>
          </Link>
          <button
            type="button"
            onClick={() => quick.start('festival')}
            disabled={quick.busy !== null}
            className="kx-lift kx-rise relative flex min-h-[220px] flex-col justify-end gap-2 overflow-hidden rounded-[26px] bg-gradient-to-br from-[#3a0a1c] to-[#7a1838] p-5 text-left text-[#fff4d6] shadow-[0_18px_36px_rgb(58_10_28/0.3)] [animation-delay:240ms] disabled:opacity-60"
          >
            <span
              className="kx-star kx-twinkle absolute top-6 left-7 h-4 w-4 bg-[#e8b04b]"
              aria-hidden="true"
            />
            <span
              className="kx-star kx-twinkle absolute top-14 left-20 h-3 w-3 bg-[#fbe7bf] [animation-delay:.8s]"
              aria-hidden="true"
            />
            <span
              className="kx-star kx-twinkle absolute top-8 right-10 h-3.5 w-3.5 bg-[#e8b04b] [animation-delay:1.5s]"
              aria-hidden="true"
            />
            <span className="w-fit rounded-full bg-[#e8b04b] px-2.5 py-1 text-xs font-bold text-[#3a0a1c]">
              {festival.days === 0 ? 'Today' : `${festival.name} in ${festival.days} days`}
            </span>
            <span className="font-display text-2xl">
              {quick.busy === 'festival' ? 'Starting…' : 'Festival greeting'}
            </span>
            <span className="text-sm text-[#f3d9c6]">
              Wish your customers, with your name on it.
            </span>
          </button>
        </div>
      </section>

      <div className="flex flex-wrap items-stretch gap-6">
        {/* Recent ads */}
        <section
          aria-labelledby="recent-title"
          className="kx-card kx-rise min-w-0 flex-[999_1_520px] rounded-[26px] p-6"
        >
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="kx-eyebrow text-indigo">Live</p>
              <h2
                id="recent-title"
                className="mt-1.5 text-2xl font-medium tracking-normal normal-case"
              >
                Your recent ads
              </h2>
            </div>
            <Link
              to="/app/ads"
              className="inline-flex min-h-11 items-center gap-1 font-semibold text-indigo"
            >
              See all ads <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          {recent.length ? (
            <ul className="mt-5 flex gap-5 overflow-x-auto px-1 pb-3">
              {recent.map((c, i) => (
                <li key={c.id} className="shrink-0">
                  <Link
                    to={`/app/campaigns/${c.id}/studio`}
                    className="kx-lift flex flex-col gap-2.5"
                  >
                    <span className="overflow-hidden rounded-[20px] shadow-[0_16px_30px_rgb(35_34_89/0.18)]">
                      <CampaignMini
                        campaign={c}
                        business={business}
                        product={c.product_id ? productById.get(c.product_id) : null}
                        businessPhoto={mainPhoto}
                        index={i}
                      />
                    </span>
                    <span className="text-sm">
                      <strong className="block max-w-[180px] truncate">{c.name}</strong>
                      <span
                        className={
                          status(c.id) === 'ready' ? 'font-semibold text-[#1f6b5f]' : 'text-muted'
                        }
                      >
                        {status(c.id) === 'ready'
                          ? 'Ready'
                          : status(c.id) === 'making'
                            ? 'Making video'
                            : 'Draft'}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-5 flex flex-col items-start gap-3 rounded-2xl bg-[#f6f3ff] p-5">
              <p className="text-muted">No ads yet. Speak one, or start from a product.</p>
              <Link
                to="/app/products"
                className="kx-btn-gold kx-sweep inline-flex min-h-12 items-center gap-2 rounded-full px-6 font-bold"
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" /> Make my first ad
              </Link>
            </div>
          )}
        </section>

        {/* Setup */}
        <section
          aria-labelledby="setup-title"
          className="kx-card kx-rise flex flex-[1_1_300px] flex-col gap-4 rounded-[26px] p-6 [animation-delay:80ms]"
        >
          <div>
            <p className="kx-eyebrow text-indigo">
              {done === steps.length ? 'All set' : 'Almost there'}
            </p>
            <h2
              id="setup-title"
              className="mt-1.5 text-2xl font-medium tracking-normal normal-case"
            >
              Your setup
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <svg
              width="112"
              height="112"
              viewBox="0 0 112 112"
              role="img"
              aria-label={`${done} of ${steps.length} steps done`}
            >
              <defs>
                <linearGradient id="setup-ring" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#3b3a8f" />
                  <stop offset="1" stopColor="#e8b04b" />
                </linearGradient>
              </defs>
              <circle cx="56" cy="56" r="48" fill="none" stroke="#efebf9" strokeWidth="12" />
              <circle
                className="kx-ring"
                cx="56"
                cy="56"
                r="48"
                fill="none"
                stroke="url(#setup-ring)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray="302"
                strokeDashoffset={302 - (302 * done) / steps.length}
                transform="rotate(-90 56 56)"
              />
              <text
                x="56"
                y="62"
                textAnchor="middle"
                fontSize="24"
                fontWeight="600"
                fill="#16152f"
                fontFamily="Jost, sans-serif"
              >
                {done}/{steps.length}
              </text>
            </svg>
            <p className="text-muted">
              {done === steps.length
                ? 'Everything is ready. Make your next ad.'
                : `${steps.length - done} quick step${steps.length - done === 1 ? '' : 's'} left.`}
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {steps
              .filter((s) => !s.done)
              .slice(0, 3)
              .map((s) => (
                <li key={s.label}>
                  <Link
                    to={s.to}
                    className="kx-lift flex min-h-12 items-center justify-between rounded-2xl bg-gradient-to-r from-[#fff6e4] to-[#fbe7bf] px-4 font-semibold"
                  >
                    {s.label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      </div>

      {/* Ideas */}
      <section
        aria-label="Ideas for this week"
        className="relative overflow-hidden rounded-[20px] bg-gradient-to-r from-[#14132e] to-[#2b2a6b] py-4"
      >
        <div className="kx-marquee flex w-max font-display text-lg whitespace-nowrap text-[#fbe7bf]">
          {[0, 1].map((k) => (
            <span key={k} className={cn('pr-10', k === 1 && 'select-none')} aria-hidden={k === 1}>
              {Array.from({ length: 2 }, () =>
                ['IDEAS FOR THIS WEEK', ...ideas].join('  ✦  '),
              ).join('  ✦  ')}{' '}
              ✦
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
