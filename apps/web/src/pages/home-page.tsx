import { ArrowRight, BadgeCheck, Languages, Layers, ShieldCheck } from 'lucide-react';
import { BillboardMockup } from '@/components/marketing/billboard-mockup';
import {
  ShareIllustration,
  StyleIllustration,
  UploadIllustration,
} from '@/components/marketing/illustrations';
import { PhoneMockup } from '@/components/marketing/phone-mockup';
import { PricingCards } from '@/components/marketing/pricing-cards';
import { StyleCard } from '@/components/marketing/style-card';
import { ButtonLink } from '@/components/ui/button';
import { Container, Section } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { styleExamples } from '@/data/styles';

const industries = [
  { name: 'Restaurants, cafés & cloud kitchens', jobs: 'Dishes, combos, discounts, openings' },
  { name: 'Retail & fashion stores', jobs: 'New arrivals, seasonal and festival sales' },
  { name: 'Salons, beauty studios & spas', jobs: 'Services, packages, appointment offers' },
];

const steps = [
  {
    title: 'Add your product',
    text: 'Snap a photo. We remove the background and remember your logo, colours and contact details.',
    Illustration: UploadIllustration,
  },
  {
    title: 'Pick a signature style',
    text: 'Outline Highlight, AI scenes, posters and more, previewed live with your real price and offer.',
    Illustration: StyleIllustration,
  },
  {
    title: 'Share everywhere',
    text: 'Download every size, from WhatsApp status and reels to print-ready posters with a QR code.',
    Illustration: ShareIllustration,
  },
];

const promises = [
  {
    Icon: BadgeCheck,
    title: 'Your facts, never invented',
    text: 'Prices, offers, dates and phone numbers come only from details you confirm.',
  },
  {
    Icon: Languages,
    title: 'Indian languages done right',
    text: 'English, Hindi, Marathi and Hinglish, drawn by templates so the text is never garbled.',
  },
  {
    Icon: Layers,
    title: 'One campaign, every format',
    text: '9:16, 1:1, 4:5 and 16:9 videos, GIFs, posters and print PDFs from a single brief.',
  },
  {
    Icon: ShieldCheck,
    title: 'You approve every ad',
    text: 'AI output is a draft. Nothing is exported until you have checked it.',
  },
];

export function HomePage() {
  return (
    <>
      {/* Hero */}
      <Section className="pt-8 md:pt-14">
        <Container className="grid items-center gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-12">
          <div className="animate-fade-up">
            <p className="mb-4 text-sm font-medium tracking-[0.25em] text-sage-deep uppercase">
              AI ad studio for Indian businesses
            </p>
            <h1 className="uppercase">
              Ads that build
              <br />
              <span className="font-normal">themselves</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted md:text-lg">
              Turn one product photo and your offer into signature animated ads, posters and copy in
              minutes. No designer, no video editor, and no prompts to write.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink to="/signup" size="lg">
                Create your first ad free
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink to="/styles" variant="outline" size="lg">
                See the styles
              </ButtonLink>
            </div>
            <p className="mt-4 text-sm text-muted">
              Free plan includes watermarked exports. No card needed.
            </p>
          </div>

          <div className="relative">
            <BillboardMockup />
            <div className="absolute -bottom-12 -left-3 hidden w-[19%] md:block lg:-left-8">
              <PhoneMockup />
            </div>
          </div>
        </Container>
      </Section>

      {/* Industries */}
      <Section className="border-y border-line bg-card">
        <Container>
          <SectionHeading
            eyebrow="Made for local business"
            title="Starting with three industries"
            intro="Each industry gets its own forms, templates, calls to action and festival calendar. More industries are added as packs."
          />
          <ul className="mt-10 grid gap-4 md:grid-cols-3">
            {industries.map((i) => (
              <li key={i.name} className="rounded-2xl border border-line bg-paper p-6">
                <p className="font-display text-xl tracking-wide">{i.name}</p>
                <p className="mt-2 text-muted">{i.jobs}</p>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* How it works */}
      <Section>
        <Container>
          <SectionHeading
            eyebrow="How it works"
            title="Three steps to a finished ad"
            align="center"
          />
          <ol className="mt-12 grid gap-8 md:grid-cols-3">
            {steps.map(({ title, text, Illustration }, index) => (
              <li key={title} className="text-center">
                <Illustration className="mx-auto h-32 w-auto" />
                <p className="mt-4 text-sm font-medium tracking-[0.25em] text-sage-deep uppercase">
                  Step {index + 1}
                </p>
                <h3 className="mt-1 uppercase">{title}</h3>
                <p className="mx-auto mt-3 max-w-xs text-muted">{text}</p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      {/* Style gallery preview */}
      <Section className="bg-paper-deep">
        <Container>
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <SectionHeading
              eyebrow="Signature styles"
              title="Not another template ad"
              intro="Code-built animations such as Outline Highlight, plus AI video scenes made from your own product photo."
            />
            <ButtonLink to="/styles" variant="outline" className="self-start md:self-auto">
              Browse all styles
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </ButtonLink>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {styleExamples.slice(0, 4).map((example) => (
              <StyleCard key={example.id} example={example} />
            ))}
          </div>
          <p className="mt-6 text-sm text-muted">All businesses shown are fictional examples.</p>
        </Container>
      </Section>

      {/* Promises */}
      <Section>
        <Container>
          <SectionHeading eyebrow="Why owners trust it" title="Accurate by design" />
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {promises.map(({ Icon, title, text }) => (
              <li key={title} className="rounded-2xl border border-line bg-card p-6 shadow-soft">
                <Icon className="h-7 w-7 text-sage-deep" aria-hidden="true" />
                <p className="mt-4 text-lg font-medium">{title}</p>
                <p className="mt-2 text-muted">{text}</p>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* Pricing */}
      <Section className="border-t border-line bg-card">
        <Container>
          <SectionHeading
            eyebrow="Pricing"
            title="Start free, upgrade when it works"
            intro="Credits scale with video length and resolution. Failed renders refund their credits automatically."
            align="center"
          />
          <div className="mt-12">
            <PricingCards />
          </div>
        </Container>
      </Section>

      {/* Final CTA */}
      <Section className="bg-ink text-paper">
        <Container className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="uppercase">Your next offer deserves a better ad</h2>
            <p className="mt-3 text-paper/70">
              Set up your business once. Create ads in minutes, every week.
            </p>
          </div>
          <ButtonLink to="/signup" size="lg" className="w-full shrink-0 sm:w-auto">
            Start free
          </ButtonLink>
        </Container>
      </Section>
    </>
  );
}
