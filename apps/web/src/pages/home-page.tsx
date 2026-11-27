import { Mic, Play, ShieldCheck, Share2, Sparkles } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import { SHOP_PARAM } from '@/features/auth/auth-schemas';
import { nextFestival } from '@/features/design/use-quick-ad';
import { cn } from '@/lib/utils';

/** The shop name typed here travels to sign-up, which offers it to onboarding. */
function HeroForm({ dark = false }: { dark?: boolean }) {
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
      className={cn(
        'mx-auto flex max-w-[560px] flex-col gap-2 rounded-full p-1.5 sm:flex-row',
        dark ? 'bg-white/10 ring-1 ring-white/25' : 'bg-paper-deep',
      )}
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
        className={cn(
          'min-h-12 flex-1 rounded-full bg-transparent px-5 text-base outline-none',
          dark ? 'text-white placeholder:text-white/60' : 'text-ink placeholder:text-muted',
        )}
      />
      <button
        type="submit"
        className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 font-bold text-navy hover:bg-white/90"
      >
        Create my first ad →
      </button>
    </form>
  );
}

function PastelCard({
  tag,
  a,
  b,
  img,
  bg,
  price,
  meta,
}: {
  tag: string;
  a: string;
  b: string;
  img: string;
  bg: string;
  price: string;
  meta: string;
}) {
  return (
    <article className={cn('kx-lift relative h-[430px] overflow-hidden rounded-[34px]', bg)}>
      <span className="absolute top-6 left-6 z-10 rounded-full bg-white px-4 py-1.5 text-[13px] font-medium">
        {tag}
      </span>
      <h3 className="absolute top-[74px] left-6 z-10 text-[34px] leading-[1.08] font-light tracking-[-0.02em]">
        {a}
        <br />
        <strong className="font-bold">{b}</strong>
      </h3>
      <div className="absolute top-[60px] -right-7 h-[300px] w-[250px] overflow-hidden rounded-[140px_140px_30px_30px]">
        <img src={img} alt="" className="kx-zoom h-full w-full object-cover" />
      </div>
      <div className="absolute inset-x-[18px] bottom-[18px] flex items-center justify-between rounded-3xl bg-white/75 py-2.5 pr-2.5 pl-5 backdrop-blur-md">
        <span>
          <span className="block font-display text-xl font-bold">{price}</span>
          <span className="text-xs text-muted">{meta}</span>
        </span>
        <span
          className="flex h-[54px] w-[54px] items-center justify-center rounded-[18px] bg-navy text-white"
          aria-hidden="true"
        >
          <Play className="h-5 w-5 fill-current" />
        </span>
      </div>
    </article>
  );
}

const PURPOSES = [
  'Promote my business',
  'Menu',
  'New arrivals',
  'Festival greeting',
  'Grand opening',
  'Offer or sale',
];
const SAID = [
  '"Mere café ka promotion karna hai"',
  '"Aaj ka special menu dikhao"',
  '"Naya collection aaya hai"',
  '"Christmas ki shubhkamnayein"',
  '"Hamari grand opening hai"',
  '"Saree pe 20 percent discount"',
];
const LOOKS = [
  'Warm brand film',
  'Chalkboard menu',
  'Fashion lookbook',
  'Festive greeting',
  'Ribbon cutting',
  'Offer badge',
];

function Step({
  n,
  title,
  text,
  example,
}: {
  n: string;
  title: string;
  text: string;
  example: ReactNode;
}) {
  return (
    <article className="kx-card kx-lift flex flex-col gap-3 rounded-[20px] p-6 text-left">
      <div className="flex items-start justify-between">
        <span className="mt-2 block h-[3px] w-[26px] rounded bg-blue" aria-hidden="true" />
        <span className="font-display text-[40px] leading-none font-light text-concrete-light">
          {n}
        </span>
      </div>
      <h3 className="text-[21px] font-bold tracking-normal">{title}</h3>
      <p className="text-[15px] leading-relaxed text-muted">{text}</p>
      <p className="mt-1 rounded-xl bg-[#f3f6ff] px-3 py-2.5 text-sm text-indigo italic">
        {example}
      </p>
    </article>
  );
}

const WHY = [
  {
    Icon: Mic,
    title: 'Speak in your language',
    text: 'Hindi, Marathi, Hinglish or English. No typing needed.',
  },
  {
    Icon: ShieldCheck,
    title: 'Prices are never made up',
    text: 'Only the prices, offers and dates you confirm appear on the ad.',
  },
  {
    Icon: Sparkles,
    title: 'A different design every time',
    text: 'AI picks the layout, motion, colours and words. Tap for another look.',
  },
  {
    Icon: Share2,
    title: 'Ready for WhatsApp and Reels',
    text: 'Video, GIF and poster in every size, with a QR code to your shop.',
  },
];
const NUMBERS: Array<[string, string]> = [
  ['3', 'Languages'],
  ['17', 'Business types'],
  ['6', 'Ad purposes'],
  ['3', 'Looks per tap'],
  ['4', 'Video sizes'],
  ['0', 'Design skills needed'],
];

/** Home page, v3: light editorial hero with pastel ad cards, then deep navy sections. */
export function HomePage() {
  const [tab, setTab] = useState(0);
  const festival = nextFestival();
  const ideas = [
    {
      img: '/images/cafe-hero.jpg',
      tag: 'Festival',
      title: `${festival.name} greeting with your shop name`,
      badge: festival.days === 0 ? 'Today' : `${festival.days}d`,
    },
    {
      img: '/images/chai.jpg',
      tag: 'Menu',
      title: 'Winter special for cold mornings',
      badge: 'Menu',
    },
    {
      img: '/images/sarees.jpg',
      tag: 'New arrivals',
      title: 'Wedding season collection launch',
      badge: 'New',
    },
    {
      img: '/images/cafe-interior.jpg',
      tag: 'Promote',
      title: 'A thank-you to your regulars',
      badge: 'Love',
    },
  ];

  return (
    <>
      {/* Hero: thin + bold headline */}
      <Container className="flex flex-wrap items-end justify-between gap-8 pt-12 pb-10 md:pt-16">
        <h1
          className="text-[clamp(46px,6.2vw,84px)] leading-[1.04] tracking-[-0.035em]"
          aria-label="Speak your ad, get a stunning video, in seconds."
        >
          <span aria-hidden="true">
            <span className="word block font-light">Speak your ad,</span>
            <span className="word block font-bold [animation-delay:120ms]">
              Get a stunning <span className="text-blue">video</span>.
            </span>
            <span className="word flex flex-wrap items-center gap-6 font-light [animation-delay:240ms]">
              In seconds
              <Link
                to="/try"
                className="inline-flex min-h-14 items-center rounded-full bg-navy px-8 font-sans text-[17px] font-semibold tracking-normal text-white hover:bg-navy-2"
              >
                Try it free
              </Link>
            </span>
          </span>
        </h1>
        <div className="animate-fade-up flex max-w-[360px] gap-4 [animation-delay:300ms]">
          <span className="mt-12 h-px w-[70px] shrink-0 bg-ink" aria-hidden="true" />
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-3">
              <span className="flex" aria-hidden="true">
                {['/images/chai.jpg', '/images/sarees.jpg', '/images/cafe-interior.jpg'].map(
                  (src, i) => (
                    <img
                      key={src}
                      src={src}
                      alt=""
                      className={cn(
                        'h-10 w-10 rounded-full border-[3px] border-white object-cover',
                        i > 0 && '-ml-3',
                      )}
                    />
                  ),
                )}
              </span>
              <span className="font-display text-[15px] font-bold">हिंदी · मराठी · English</span>
            </div>
            <p className="text-[15px] leading-relaxed text-muted">
              Say it in your language. Kalpix writes, designs and animates the ad, ready for
              WhatsApp and Reels.
            </p>
          </div>
        </div>
      </Container>

      {/* Pastel example ads */}
      <Container>
        <figure
          aria-label="Example ads"
          className="m-0 grid gap-6 pb-14 sm:grid-cols-2 lg:grid-cols-3"
        >
          <Reveal delay={60}>
            <PastelCard
              tag="Café"
              a="Masala"
              b="Chai"
              img="/images/chai.jpg"
              bg="bg-pink"
              price="₹20"
              meta="Hinglish · 9:16"
            />
          </Reveal>
          <Reveal delay={160}>
            <PastelCard
              tag="Boutique"
              a="Silk"
              b="Sarees"
              img="/images/sarees.jpg"
              bg="bg-lemon"
              price="New collection"
              meta="English · 4:5"
            />
          </Reveal>
          <Reveal delay={260}>
            <PastelCard
              tag="Restaurant"
              a="Grand"
              b="Opening"
              img="/images/cafe-hero.jpg"
              bg="bg-lilac"
              price="आता सुरू!"
              meta="Marathi · 9:16"
            />
          </Reveal>
        </figure>
      </Container>

      {/* Made for */}
      <Container>
        <ul
          aria-label="Made for every business"
          className="flex flex-wrap items-center justify-between gap-7 border-y border-line py-8 text-[#2a2f4a]"
        >
          {[
            ['CAFÉS', '& RESTAURANTS'],
            ['BOUTIQUES', 'FASHION'],
            ['CLINICS', '& PHARMACIES'],
            ['GYMS', 'FITNESS'],
            ['SALONS', '& BEAUTY'],
            ['REAL', 'ESTATE'],
          ].map(([a, b]) => (
            <li
              key={a}
              className="font-display text-[15px] leading-tight font-extrabold tracking-[0.1em]"
            >
              {a}
              <span className="block text-[11px] font-normal tracking-[0.3em]">{b}</span>
            </li>
          ))}
        </ul>
      </Container>

      {/* Dark navy photo section */}
      <section
        aria-labelledby="voice-title"
        className="kx-slant-both relative mt-16 px-6 pt-36 pb-40 text-center text-white"
      >
        <img
          src="/images/cafe-hero.jpg"
          alt=""
          className="kb absolute inset-0 h-full w-full object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(180deg,rgb(11_16_51/0.9)_0%,rgb(18_26_74/0.82)_55%,rgb(11_16_51/0.95)_100%)]"
        />
        <Reveal className="relative mx-auto flex max-w-[900px] flex-col items-center gap-6">
          <h2
            id="voice-title"
            className="text-[clamp(38px,5vw,64px)] leading-[1.04] font-extrabold tracking-[-0.01em] uppercase"
          >
            Build your <span className="text-blue">business</span>
            <br />
            with your voice
          </h2>
          <p className="max-w-[640px] text-lg leading-relaxed text-[#c9cdf0]">
            Tap the mic and say it the way you talk to customers: "Diwali sale ka ad banao, saree
            pandrah sau ki". Kalpix fills in the details, you check them, and your ad is ready.
          </p>
          <Link
            to="/try"
            className="kx-bluepulse inline-flex min-h-14 items-center gap-2.5 rounded-full bg-blue px-7 font-semibold text-white"
          >
            <Mic className="h-[18px] w-[18px]" aria-hidden="true" /> Speak your first ad
          </Link>
          <span
            className="mt-6 flex h-[42px] w-[26px] justify-center rounded-[14px] border-2 border-white/60 pt-[7px]"
            aria-hidden="true"
          >
            <span className="kx-scrolldot h-2 w-1 rounded bg-white" />
          </span>
        </Reveal>
      </section>

      {/* Purposes with tabs */}
      <Container className="pt-10 pb-24 text-center">
        <h2 className="text-[clamp(32px,3.6vw,44px)] font-medium">
          We make ads for every <span className="text-blue">purpose</span>
        </h2>
        <p className="mx-auto mt-3 max-w-[560px] text-muted">
          Promote your place, your menu, a festival or a grand opening. Pick what the ad is for.
        </p>
        <span className="mx-auto mt-5 block h-[3px] w-[60px] rounded bg-blue" aria-hidden="true" />
        <div
          role="tablist"
          aria-label="Ad purpose"
          className="mt-8 flex flex-wrap justify-center gap-2"
        >
          {PURPOSES.map((p, i) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={tab === i}
              onClick={() => setTab(i)}
              className="kx-chip min-h-11 rounded-full px-5 text-[15px] font-medium"
            >
              {p}
            </button>
          ))}
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Step
            n="01"
            title="Speak it"
            text="Tap the mic and say what you want, in your language."
            example={SAID[tab]}
          />
          <Step
            n="02"
            title="Check it"
            text="Kalpix fills in the details. Change anything before it is made."
            example="Price, dates and timings, read back to you"
          />
          <Step
            n="03"
            title="AI designs it"
            text="Three different looks every time. Pick one, or tap for more."
            example={`Today: ${LOOKS[tab]}`}
          />
          <Step
            n="04"
            title="Share it"
            text="Video, GIF and poster for WhatsApp Status, Reels and print."
            example="9:16 · 1:1 · 4:5 · 16:9"
          />
        </div>
      </Container>

      {/* Why + numbers */}
      <section className="kx-night relative px-6 pt-32 pb-28 text-white [clip-path:polygon(0_0,50%_6%,100%_0,100%_100%,0_100%)]">
        <div className="mx-auto grid max-w-[1240px] gap-14 lg:grid-cols-2">
          <div>
            <h2 className="text-[clamp(32px,3.6vw,44px)] font-medium">
              Why shop owners choose <span className="text-blue">Kalpix</span>
            </h2>
            <ul className="mt-8 flex flex-col gap-5">
              {WHY.map(({ Icon, title, text }) => (
                <li key={title} className="flex gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue/50 text-[#8fb0ff]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>
                    <strong className="block font-display text-lg font-semibold">{title}</strong>
                    <span className="text-[15px] text-[#b8bde6]">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-[clamp(32px,3.6vw,44px)] font-medium">
              Everything you need, in <span className="text-blue">numbers</span>
            </h2>
            <span className="mt-4 block h-[3px] w-[60px] rounded bg-blue" aria-hidden="true" />
            <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {NUMBERS.map(([n, label]) => (
                <div
                  key={label}
                  className="kx-lift rounded-[18px] border border-[#8fb0ff]/45 px-3 py-6 text-center"
                >
                  <p className="font-display text-[40px] leading-none font-medium">{n}</p>
                  <p className="mt-2 text-[13px] text-[#b8bde6]">{label}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-[#c9cdf0]">
              Plans from <strong className="text-white">₹399</strong> a month.{' '}
              <Link
                to="/pricing"
                className="font-semibold text-[#8fb0ff] underline underline-offset-4"
              >
                See pricing
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Ad of the week */}
      <Container className="grid items-end gap-7 pt-24 pb-14 md:grid-cols-3">
        <div className="kx-lift h-[340px] overflow-hidden rounded-[34px]">
          <img
            src="/images/sarees.jpg"
            alt="A boutique ad with silk sarees"
            className="kx-zoom h-full w-full object-cover"
          />
        </div>
        <div className="kx-lift relative h-[460px] overflow-hidden rounded-[34px]">
          <img
            src="/images/chai.jpg"
            alt="A café ad with masala chai"
            className="kx-zoom h-full w-full object-cover"
          />
          <span className="absolute bottom-4 left-4 rounded-2xl bg-white/85 px-4 py-2.5 text-sm font-semibold backdrop-blur">
            Made in 1 tap · Hinglish
          </span>
        </div>
        <div className="pb-5">
          <h2 className="text-[clamp(36px,4vw,52px)] leading-[1.1] font-normal tracking-[-0.03em]">
            Ad Of
            <br />
            <strong className="font-bold">The Week</strong>
          </h2>
          <p className="mt-4 leading-relaxed text-muted">
            "Garam chai, ghar jaisa swaad." A café owner said one sentence; Kalpix made the video,
            the poster and the WhatsApp GIF.
          </p>
          <Link
            to="/styles"
            className="mt-5 inline-flex min-h-12 items-center rounded-full bg-navy px-6 font-semibold text-white"
          >
            See more styles
          </Link>
        </div>
      </Container>

      {/* Fresh ideas */}
      <Container className="pt-10 pb-28 text-center">
        <h2 className="text-[clamp(32px,3.6vw,44px)] font-medium">
          Fresh ad <span className="text-blue">ideas</span> for this month
        </h2>
        <span className="mx-auto mt-5 block h-[3px] w-[60px] rounded bg-blue" aria-hidden="true" />
        <div className="mt-10 grid gap-5 text-left sm:grid-cols-2 lg:grid-cols-4">
          {ideas.map((i) => (
            <article key={i.title} className="kx-card kx-lift overflow-hidden rounded-[18px]">
              <div className="relative h-[170px] overflow-hidden">
                <img src={i.img} alt="" className="kx-zoom h-full w-full object-cover" />
                <span className="absolute right-3.5 -bottom-px bg-blue px-2.5 py-2 font-display text-sm font-bold text-white">
                  {i.badge}
                </span>
              </div>
              <div className="flex flex-col gap-2 p-4">
                <h3 className="text-lg leading-snug font-bold tracking-normal">{i.title}</h3>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-semibold text-indigo">{i.tag}</span>
                  <Link to="/try" className="font-semibold text-ink">
                    Make this ad →
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Container>

      {/* CTA band */}
      <section
        aria-labelledby="cta-title"
        className="relative bg-[linear-gradient(120deg,#0b1033,#22307a_60%,#3b3a8f)] px-6 pt-28 pb-24 text-center text-white [clip-path:polygon(0_12%,100%_0,100%_100%,0_100%)]"
      >
        <h2
          id="cta-title"
          className="text-[clamp(34px,4.4vw,56px)] leading-[1.05] font-extrabold uppercase"
        >
          Your first ad is <span className="text-gold">free</span>
        </h2>
        <p className="mx-auto mt-3.5 max-w-[520px] text-[17px] text-[#c9cdf0]">
          Type your shop name to start, or try one ad without signing up.
        </p>
        <div className="mt-7">
          <HeroForm dark />
        </div>
        <p className="mt-4 text-sm text-[#c9cdf0]">
          Free plan · No card needed ·{' '}
          <Link to="/try" className="text-white underline underline-offset-4">
            Try without signing up
          </Link>
        </p>
      </section>
    </>
  );
}
