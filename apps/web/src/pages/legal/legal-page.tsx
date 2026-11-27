import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Container } from '@/components/ui/container';
import { site } from '@/config/site';
import { cn } from '@/lib/utils';

export type LegalSection = { id: string; title: string; body: ReactNode };

const DOCS = [
  { to: '/privacy', label: 'Privacy' },
  { to: '/terms', label: 'Terms' },
  { to: '/refunds', label: 'Refunds' },
];

/**
 * Shared layout for Privacy, Terms and Refunds (v3): a slanted navy header with tabs, a sticky
 * contents list and numbered sections. The text is a draft for a lawyer to review.
 */
export function LegalPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: ReactNode;
  sections: LegalSection[];
}) {
  const { pathname } = useLocation();
  return (
    <>
      <section className="kx-night px-6 pt-16 pb-24 text-white [clip-path:polygon(0_0,100%_0,100%_82%,0_100%)]">
        <Container>
          <h1 className="text-[clamp(36px,4.4vw,58px)] leading-[1.05] font-extrabold tracking-normal uppercase">
            {title}
          </h1>
          <p className="mt-3 text-[#c9cdf0]">Last updated: {site.lastUpdated}</p>
          <nav aria-label="Policies" className="mt-6 flex flex-wrap gap-2">
            {DOCS.map((d) => (
              <Link
                key={d.to}
                to={d.to}
                aria-current={pathname === d.to ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-11 items-center rounded-full border px-5 font-semibold',
                  pathname === d.to
                    ? 'border-white bg-white text-navy'
                    : 'border-white/35 text-white hover:bg-white/10',
                )}
              >
                {d.label}
              </Link>
            ))}
          </nav>
        </Container>
      </section>

      <Container className="flex flex-wrap items-start gap-12 pt-6 pb-24">
        <nav
          aria-label="On this page"
          className="sticky top-24 w-full max-w-[300px] flex-[1_1_240px] rounded-[22px] bg-paper-deep p-6"
        >
          <p className="mb-3 text-xs font-bold tracking-[0.2em] text-muted">ON THIS PAGE</p>
          <ol>
            {sections.map((s, i) => (
              <li key={s.id} className="border-b border-line last:border-0">
                <a
                  href={`#${s.id}`}
                  className="flex min-h-11 items-center gap-3 font-medium text-ink"
                >
                  <span className="font-display text-sm font-semibold text-blue">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="min-w-0 flex-[999_1_560px]">
          <p className="rounded-2xl bg-peach p-4 text-sm">
            Draft for review: this text must be checked by a qualified lawyer before Kalpix accepts
            live payments.
          </p>
          <div className="mt-6 text-base text-ink/90 md:text-lg">{intro}</div>
          <div className="mt-10 space-y-10">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-24">
                <p
                  className="font-display text-[40px] leading-none font-light text-concrete-light"
                  aria-hidden="true"
                >
                  {String(i + 1).padStart(2, '0')}
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-normal md:text-[26px]">
                  {i + 1}. {s.title}
                </h2>
                <span className="my-3 block h-[3px] w-10 rounded bg-blue" aria-hidden="true" />
                <div className="space-y-3 text-ink/85 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
                  {s.body}
                </div>
              </section>
            ))}
          </div>
        </article>
      </Container>
    </>
  );
}
