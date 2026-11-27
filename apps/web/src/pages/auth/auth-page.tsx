import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Container, Section } from '@/components/ui/container';
import { ThinBold } from '@/components/ui/thin-bold';

/** Shared two-column shell for the sign-in pages. The illustration panel shows on large screens. */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
}) {
  return (
    <Section className="pt-8 md:pt-14">
      <Container className="grid items-stretch gap-10 lg:grid-cols-2">
        <div className="mx-auto w-full max-w-md lg:order-2 lg:self-center">
          <h1 className="text-[clamp(38px,4.4vw,52px)] leading-[1.05] tracking-[-0.03em]">
            <ThinBold text={title} />
          </h1>
          <p className="mt-3 text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
        {/* Navy photo panel with a floating ad card (v3). */}
        <div className="relative hidden min-h-[620px] flex-col justify-between overflow-hidden rounded-[32px] p-10 text-white lg:flex">
          <img
            src="/images/cafe-hero.jpg"
            alt=""
            className="kb absolute inset-0 h-full w-full object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(160deg,rgb(11_16_51/0.92),rgb(18_26_74/0.75)_60%,rgb(11_16_51/0.95))]"
          />
          <span className="relative w-fit rounded-full border border-white/30 bg-white/10 px-3.5 py-1.5 text-sm">
            हिंदी · मराठी · English
          </span>
          <div className="relative w-64 self-center overflow-hidden rounded-[30px] bg-pink text-ink shadow-2xl [animation:float_5s_ease-in-out_infinite]">
            <img src="/images/chai.jpg" alt="" className="h-52 w-full object-cover" />
            <div className="p-4">
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold">Café</span>
              <p className="mt-2.5 font-display text-2xl leading-tight font-light">
                Garam chai,
                <br />
                <strong className="font-bold">ghar jaisa swaad</strong>
              </p>
            </div>
          </div>
          <div className="relative">
            <p className="font-display text-[clamp(26px,2.6vw,36px)] leading-[1.08] font-extrabold uppercase">
              Say it once.
              <br />
              <span className="text-blue">Share it</span> everywhere.
            </p>
            <p className="mt-2 text-[#c9cdf0]">
              Ads for WhatsApp Status, Reels and posters, in your language.
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}

export function GoogleButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <Button variant="outline" className="w-full" onClick={onClick} disabled={disabled}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M22.6 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h6c-.3 1.4-1 2.5-2.2 3.3v2.8h3.6c2-1.9 3.2-4.7 3.2-8.1z"
        />
        <path
          fill="#34A853"
          d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9C3.9 20.6 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.8 14.1c-.2-.7-.4-1.4-.4-2.1s.1-1.4.4-2.1V7H2.1C1.4 8.5 1 10.2 1 12s.4 3.5 1.1 5l3.7-2.9z"
        />
        <path
          fill="#EA4335"
          d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2C17.5 2.1 15 1 12 1 7.7 1 3.9 3.4 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4z"
        />
      </svg>
      Continue with Google
    </Button>
  );
}

export function Divider() {
  return (
    <div className="my-6 flex items-center gap-3 text-sm text-muted">
      <span className="h-px flex-1 bg-line" />
      or
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export function SwitchAuthLink({
  question,
  to,
  label,
}: {
  question: string;
  to: string;
  label: string;
}) {
  return (
    <p className="mt-8 text-center text-muted">
      {question}{' '}
      <Link
        to={to}
        className="inline-flex min-h-11 items-center font-medium text-ink underline underline-offset-4"
      >
        {label}
      </Link>
    </p>
  );
}
