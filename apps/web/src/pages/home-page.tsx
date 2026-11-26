import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HeroAd } from '@/components/marketing/hero-ad';
import { CountUp } from '@/components/motion/count-up';
import { Reveal } from '@/components/motion/reveal';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { SHOP_PARAM } from '@/features/auth/auth-schemas';
import { formatInr } from '@/lib/utils';

const madeFor = ['Cafés', 'Clothing stores', 'Salons', 'Sweet shops', 'Jewellers', 'Gyms'];

const steps = [
  {
    title: 'Add your product',
    text: 'One phone photo. We remove the background and trace its outline.',
  },
  {
    title: 'Write your offer',
    text: 'Price, discount and dates. You confirm each one before it appears.',
  },
  {
    title: 'Download and share',
    text: 'Video, GIF and poster in every size, with a QR code to WhatsApp.',
  },
];

/** The shop name typed here travels to sign-up, which offers it to onboarding. */
function HeroForm() {
  const navigate = useNavigate();
  const [shop, setShop] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = shop.trim().slice(0, 120);
    navigate(name ? `/signup?${SHOP_PARAM}=${encodeURIComponent(name)}` : '/signup');
  };
  return (
    <form
      onSubmit={submit}
      className="flex max-w-[540px] flex-col gap-2 rounded-2xl border border-line bg-card p-1.5 sm:flex-row"
    >
      <label htmlFor="hero-shop" className="sr-only">
        Your shop name
      </label>
      <input
        id="hero-shop"
        value={shop}
        onChange={(e) => setShop(e.target.value)}
        placeholder="Your shop name"
        autoComplete="organization"
        maxLength={120}
        className="min-h-12 flex-1 rounded-xl bg-transparent px-3.5 text-base outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-indigo"
      />
      <button
        type="submit"
        className="btn-shine inline-flex min-h-12 items-center justify-center rounded-xl bg-lamp px-5 font-semibold text-ink transition-transform hover:bg-lamp-deep"
      >
        Create my first ad →
      </button>
    </form>
  );
}

export function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-10 pb-10 md:pt-14">
        <Container className="flex flex-wrap items-center gap-12">
          <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-5">
            <div className="animate-fade-up flex flex-wrap gap-2">
              <span className="rounded-full border border-line bg-card px-3.5 py-1.5 text-sm">
                Videos
              </span>
              <span className="rounded-full border border-line bg-card px-3.5 py-1.5 text-sm">
                Posters
              </span>
              <span className="rounded-full bg-indigo-deep px-3.5 py-1.5 text-sm text-white">
                WhatsApp Status
              </span>
            </div>
            <h1 className="animate-fade-up text-[clamp(40px,6vw,76px)] leading-[1.03] font-medium tracking-[-0.01em] [animation-delay:120ms]">
              Ads that build themselves, <span className="text-indigo">for your shop.</span>
            </h1>
            <p className="animate-fade-up max-w-[540px] text-lg leading-relaxed text-muted [animation-delay:240ms] md:text-[19px]">
              Add one product photo and your offer. Kalpix makes animated ads, posters and captions
              in minutes, with your prices exactly as you confirm them.
            </p>
            <div className="animate-fade-up [animation-delay:360ms]">
              <HeroForm />
            </div>
            <p className="animate-fade-up text-sm text-muted [animation-delay:480ms]">
              Free plan · No card needed · Or{' '}
              <Link to="/try" className="text-indigo underline underline-offset-4">
                try one ad without signing up
              </Link>
            </p>
          </div>
          <div className="animate-fade-up min-w-0 flex-[1_1_400px] [animation-delay:240ms]">
            <HeroAd />
          </div>
        </Container>
      </section>

      {/* Made for */}
      <section className="pb-10">
        <Container>
          <Reveal className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 border-y border-line py-5 font-display text-xl text-muted">
            <span>Made for</span>
            {madeFor.map((m) => (
              <span key={m} className="text-ink">
                {m}
              </span>
            ))}
          </Reveal>
        </Container>
      </section>

      {/* How it works */}
      <section className="py-12 md:py-16">
        <Container>
          <Reveal>
            <p className="text-center text-[13px] font-semibold tracking-[0.2em] text-indigo">
              HOW IT WORKS
            </p>
            <h2 className="mt-2.5 text-center font-medium">Three steps to your first ad</h2>
          </Reveal>
          <ol className="mt-9 grid gap-5 md:grid-cols-3">
            {steps.map((s, i) => (
              <Reveal
                as="li"
                key={s.title}
                delay={(i + 1) * 120}
                className="card-lift rounded-3xl border border-line bg-card p-7"
              >
                <p className="font-display text-[44px] leading-none font-light text-lamp-deep">
                  0{i + 1}
                </p>
                <h3 className="mt-3 font-sans text-xl font-semibold tracking-normal">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{s.text}</p>
              </Reveal>
            ))}
          </ol>
        </Container>
      </section>

      {/* Why Kalpix */}
      <section className="py-12 md:py-16">
        <Container>
          <Reveal>
            <p className="text-center text-[13px] font-semibold tracking-[0.2em] text-indigo">
              WHY KALPIX
            </p>
            <h2 className="mt-2.5 text-center font-medium">Why shop owners choose Kalpix</h2>
          </Reveal>
          <div className="mt-9 grid gap-5 md:grid-cols-3">
            <Reveal delay={120} className="flex flex-col gap-2.5 rounded-[28px] bg-lamp-soft p-8">
              <CountUp to={10} className="font-display text-7xl leading-none font-medium" />
              <p className="text-xl font-medium">free credits to start</p>
              <p className="text-muted">Enough for your first ads in every size. No card needed.</p>
            </Reveal>
            <Reveal delay={240} className="flex flex-col gap-2.5 rounded-[28px] bg-indigo-soft p-8">
              <CountUp
                to={4}
                className="font-display text-7xl leading-none font-medium text-indigo"
              />
              <p className="text-xl font-medium">sizes from one design</p>
              <div className="mt-1.5 flex items-end gap-2.5" aria-hidden="true">
                <div className="h-16 w-9 rounded-md bg-indigo" />
                <div className="h-[50px] w-[50px] rounded-md bg-indigo" />
                <div className="h-[55px] w-11 rounded-md bg-indigo" />
                <div className="h-[45px] w-20 rounded-md bg-indigo" />
              </div>
            </Reveal>
            <Reveal
              delay={360}
              className="flex flex-col gap-3.5 rounded-[28px] bg-indigo-deep p-8 text-paper"
            >
              <p className="text-xl font-medium">Your prices, exactly</p>
              <p className="leading-relaxed text-paper/80">
                AI never invents a price, phone number or date. Only what you confirm goes into the
                ad.
              </p>
              <div
                className="badge-pop mt-1.5 flex h-24 w-24 items-center justify-center rounded-full bg-lamp text-center text-xl leading-none font-bold text-ink"
                aria-hidden="true"
              >
                20%
                <br />
                OFF
              </div>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Pricing band */}
      <section className="pt-6 pb-16 md:pb-20">
        <Container>
          <Reveal className="flex flex-wrap items-center justify-between gap-7 rounded-[32px] bg-indigo-deep px-6 py-10 text-paper sm:px-10 sm:py-12">
            <div className="min-w-0 flex-[1_1_420px]">
              <h2 className="leading-tight font-medium">
                Plans from <CountUp to={399} format={formatInr} className="text-gold" /> a month
              </h2>
              <p className="mt-3 text-lg text-paper/80">
                Start free. Upgrade when your ads bring customers in. Pay by UPI, card or
                netbanking.
              </p>
            </div>
            <ButtonLink to="/pricing" size="lg" className="btn-shine w-full sm:w-auto">
              See pricing →
            </ButtonLink>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
