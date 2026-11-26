import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { OutlineDemo } from '@/components/marketing/outline-demo';
import { Button } from '@/components/ui/button';
import { Container, Section } from '@/components/ui/container';

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
        <div className="mx-auto w-full max-w-md">
          <h1 className="uppercase">{title}</h1>
          <p className="mt-3 text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
        <div className="hidden overflow-hidden rounded-3xl bg-gradient-to-b from-lamp-soft to-[#e7d2ad] p-10 lg:flex lg:flex-col lg:justify-between">
          <p className="font-display text-2xl tracking-[0.15em] text-ink/80 uppercase">
            One profile.
            <br />
            Every ad.
          </p>
          <div className="mx-auto h-72 w-56">
            <OutlineDemo offer="NEW" productName="Your product" />
          </div>
          <p className="text-ink/70">
            Save your logo, colours and products once. Every ad after that takes minutes.
          </p>
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
