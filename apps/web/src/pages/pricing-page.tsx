import { PricingCards } from '@/components/marketing/pricing-cards';
import { ButtonLink } from '@/components/ui/button';
import { Container, Section } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { festivalPack } from '@/data/plans';
import { useAuth } from '@/features/auth/auth-context';
import { usePacks } from '@/features/billing/hooks';
import { formatInr } from '@/lib/utils';

const faqs = [
  {
    q: 'What is a credit?',
    a: 'Credits pay for rendering. A short poster costs little; longer videos, AI video scenes, voice and higher resolutions cost more. Previews in the studio are always free. You only spend credits when you export.',
  },
  {
    q: 'What happens if a render fails?',
    a: 'Credits are reserved when you export and returned automatically if the render fails.',
  },
  {
    q: 'Can I cancel any time?',
    a: 'Yes. Cancel from the billing page; your plan stays active until the end of the paid month. See the Refund & Cancellation policy for details.',
  },
  {
    q: 'How do I pay?',
    a: 'Through Razorpay: UPI Autopay, cards and other Indian payment methods. GST invoices are provided.',
  },
  {
    q: 'Is there unlimited video?',
    a: 'No. Video rendering and AI video cost real money per second, so every plan has a fair monthly credit allowance.',
  },
];

export function PricingPage() {
  const { user } = useAuth();
  const packs = usePacks();
  const dbPack = packs.data?.find((k) => k.id === 'festival');
  const pack = dbPack
    ? { name: dbPack.name, price: dbPack.price_inr, description: dbPack.description }
    : festivalPack;

  return (
    <>
      <Section className="pt-8 md:pt-14">
        <Container>
          <SectionHeading
            as="h1"
            eyebrow="Pricing"
            title="Simple plans in rupees"
            intro="Start free. Upgrade when your ads start bringing customers in. Indicative prices for early access."
          />
          <div className="mt-12">
            <PricingCards />
          </div>
        </Container>
      </Section>

      <Section className="pt-0 md:pt-0">
        <Container>
          <div className="kx-lift flex flex-col gap-6 rounded-[30px] bg-peach p-7 md:flex-row md:items-center md:justify-between md:p-10">
            <div>
              <span className="rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold">
                Pay once
              </span>
              <p className="mt-3 font-display text-[34px] leading-tight font-light tracking-[-0.02em]">
                {pack.name} · <strong className="font-bold">{formatInr(pack.price)}</strong>
              </p>
              <p className="mt-2 max-w-xl text-ink/80">{pack.description}</p>
            </div>
            <ButtonLink
              to={user ? '/app/billing' : '/signup?pack=festival'}
              variant="dark"
              className="w-full md:w-auto"
            >
              Get the festival pack
            </ButtonLink>
          </div>
        </Container>
      </Section>

      {/* How credits work */}
      <section className="kx-night mt-6 px-6 pt-28 pb-24 text-white [clip-path:polygon(0_0,50%_7%,100%_0,100%_100%,0_100%)]">
        <Container>
          <h2 className="text-center text-[clamp(30px,3.6vw,44px)] font-medium">
            How <span className="text-blue">credits</span> work
          </h2>
          <span
            className="mx-auto mt-4 block h-[3px] w-[60px] rounded bg-blue"
            aria-hidden="true"
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['1', 'credit makes one size of an ad: a video, a GIF and a poster.'],
              ['0', 'credits to design, preview and change your ad as often as you like.'],
              ['4', 'sizes: Status and Reels, square, portrait and wide.'],
              ['100%', 'of the credits come back if an export fails.'],
            ].map(([n, t]) => (
              <div key={t} className="kx-lift rounded-[20px] border border-[#8fb0ff]/45 p-6">
                <p className="font-display text-[44px] leading-none font-medium">{n}</p>
                <p className="mt-2.5 text-[#c9cdf0]">{t}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <Section>
        <Container className="max-w-3xl">
          <SectionHeading title="Questions" align="center" />
          <div className="mt-8 divide-y divide-line border-y border-line">
            {faqs.map((f) => (
              <details key={f.q} className="group py-2">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-semibold">
                  {f.q}
                  <span
                    aria-hidden="true"
                    className="text-[28px] font-light text-blue transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="pb-4 text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}
