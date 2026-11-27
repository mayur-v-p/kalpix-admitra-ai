import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HeroAdPhoto } from '@/components/marketing/hero-ad-photo';
import { CountUp } from '@/components/motion/count-up';
import { Reveal } from '@/components/motion/reveal';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { SHOP_PARAM } from '@/features/auth/auth-schemas';
import { formatInr } from '@/lib/utils';

const headlineWords = ['Ads', 'that', 'build', 'themselves,'];
const shops = ['for your café.', 'for your restaurant.', 'for your boutique.'];

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
      className="flex max-w-[540px] flex-col gap-2 rounded-2xl bg-card p-1.5 sm:flex-row"
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
        className="min-h-12 flex-1 rounded-xl bg-transparent px-3.5 text-base text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-indigo"
      />
      <button
        type="submit"
        className="btn-shine inline-flex min-h-12 items-center justify-center rounded-xl bg-lamp px-5 font-semibold text-ink hover:bg-lamp-deep"
      >
        Create my first ad →
      </button>
    </form>
  );
}

/** Home page, version 2: a real café photo behind the headline, then why Kalpix and pricing. */
export function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink">
        <img
          src="/images/cafe-hero.jpg"
          alt=""
          className="kb absolute inset-0 h-full w-full object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(90deg,rgb(28_27_58/0.92)_0%,rgb(28_27_58/0.78)_45%,rgb(28_27_58/0.35)_100%)]"
        />
        <Container className="relative flex flex-wrap items-center gap-10 py-14 md:py-16">
          <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-5 text-paper">
            <p className="animate-fade-up w-fit rounded-full border border-paper/30 bg-paper/15 px-3.5 py-1.5 text-sm">
              AI ad studio for Indian shops
            </p>
            <h1
              className="text-[clamp(40px,5.6vw,72px)] leading-[1.1] font-medium"
              aria-label="Ads that build themselves, for your café, restaurant or boutique."
            >
              <span aria-hidden="true">
                {headlineWords.map((w, i) => (
                  <span key={w}>
                    <span className="word" style={{ animationDelay: `${100 + i * 120}ms` }}>
                      {w}
                    </span>{' '}
                  </span>
                ))}
                <span className="word inline-grid text-lamp [animation-delay:700ms]">
                  {shops.map((s, i) => (
                    <span key={s} className={i === 0 ? 'rot' : i === 1 ? 'rot rot-2' : 'rot rot-3'}>
                      {s}
                    </span>
                  ))}
                </span>
              </span>
            </h1>
            <p className="animate-fade-up max-w-[560px] text-lg leading-relaxed text-paper/90 [animation-delay:300ms] md:text-[19px]">
              Add one product photo and your offer, or just say it. Kalpix makes animated ads,
              posters and captions in minutes, with your prices exactly as you confirm them.
            </p>
            <div className="animate-fade-up [animation-delay:450ms]">
              <HeroForm />
            </div>
            <p className="animate-fade-up text-sm text-paper/80 [animation-delay:600ms]">
              Free plan · No card needed · Or{' '}
              <Link to="/try" className="text-paper underline underline-offset-4">
                try one ad without signing up
              </Link>
            </p>
          </div>
          <div className="animate-fade-up min-w-0 flex-[1_1_380px] [animation-delay:300ms]">
            <HeroAdPhoto />
          </div>
        </Container>
      </section>

      {/* Why Kalpix */}
      <section className="py-14 md:py-20">
        <Container>
          <Reveal>
            <p className="text-center text-[13px] font-semibold tracking-[0.2em] text-indigo">
              WHY KALPIX
            </p>
            <h2 className="mt-2.5 text-center">Why shop owners choose Kalpix</h2>
          </Reveal>
          <div className="mt-9 grid gap-5 md:grid-cols-3">
            <Reveal
              delay={120}
              className="card-lift relative min-h-[280px] overflow-hidden rounded-[28px] text-paper"
            >
              <img
                src="/images/cafe-interior.jpg"
                alt="A bright café interior with tables and chairs"
                className="kb absolute inset-0 h-full w-full object-cover"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[linear-gradient(180deg,rgb(28_27_58/0.05)_30%,rgb(28_27_58/0.85)_100%)]"
              />
              <div className="absolute inset-x-7 bottom-6">
                <p className="text-[22px] font-semibold">Made for real Indian shops</p>
                <p className="mt-1.5 text-paper/85">
                  Cafés, restaurants, boutiques, kirana stores and more.
                </p>
              </div>
            </Reveal>
            <Reveal
              delay={240}
              className="card-lift flex flex-col gap-2.5 rounded-[28px] bg-lamp-soft p-8"
            >
              <CountUp to={10} className="font-display text-7xl leading-none font-medium" />
              <p className="text-xl font-medium">free credits to start</p>
              <CountUp
                to={4}
                className="mt-2.5 font-display text-7xl leading-none font-medium text-indigo"
              />
              <p className="text-xl font-medium">sizes from one design</p>
            </Reveal>
            <Reveal
              delay={360}
              className="card-lift flex flex-col gap-3.5 rounded-[28px] bg-indigo-deep p-8 text-paper"
            >
              <p className="text-[22px] font-semibold">Your prices, exactly</p>
              <p className="leading-relaxed text-paper/80">
                AI never invents a price, phone number or date. Only what you confirm goes into the
                ad, even when you speak it.
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
      <section className="pt-2 pb-16 md:pb-20">
        <Container>
          <Reveal className="flex flex-wrap items-center justify-between gap-7 rounded-[32px] bg-indigo-deep px-6 py-10 text-paper sm:px-10 sm:py-12">
            <div className="min-w-0 flex-[1_1_420px]">
              <h2 className="leading-tight">
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
