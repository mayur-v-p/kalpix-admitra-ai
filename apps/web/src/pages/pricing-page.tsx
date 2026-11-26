import { PricingCards } from '@/components/marketing/pricing-cards';
import { ButtonLink } from '@/components/ui/button';
import { Container, Section } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { festivalPack } from '@/data/plans';
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
          <div className="flex flex-col gap-6 rounded-2xl border border-line bg-lamp-soft p-6 md:flex-row md:items-center md:justify-between md:p-8">
            <div>
              <p className="font-display text-2xl tracking-[0.12em] uppercase">
                {festivalPack.name} · {formatInr(festivalPack.price)}
              </p>
              <p className="mt-2 max-w-xl text-ink/80">{festivalPack.description}</p>
            </div>
            <ButtonLink to="/signup?pack=festival" variant="dark" className="w-full md:w-auto">
              Get the festival pack
            </ButtonLink>
          </div>
        </Container>
      </Section>

      <Section className="border-t border-line bg-card">
        <Container className="max-w-3xl">
          <SectionHeading title="Questions" />
          <div className="mt-8 divide-y divide-line border-y border-line">
            {faqs.map((f) => (
              <details key={f.q} className="group py-2">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 text-lg">
                  {f.q}
                  <span
                    aria-hidden="true"
                    className="text-2xl text-muted transition-transform group-open:rotate-45"
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
